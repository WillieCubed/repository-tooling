import { z } from 'zod';
import { matchesPinnedRules } from './ruleset.ts';

const checkBinding = z.object({
  context: z.string().trim().min(1),
  integrationId: z.number().int().positive(),
});
export type CheckBinding = z.infer<typeof checkBinding>;
export interface PolicyFinding {
  rule: string;
  message: string;
}
const rule = z.object({
  type: z.string(),
  ruleset_id: z.number().int().positive().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});
const detail = z.object({
  id: z.number().int().positive(),
  target: z.string(),
  enforcement: z.string(),
  bypass_actors: z.array(z.unknown()).optional(),
});
const merge = z.object({
  allow_merge_commit: z.boolean(),
  allow_squash_merge: z.boolean(),
  allow_rebase_merge: z.boolean(),
});
const actions = z.object({
  enabled: z.boolean(),
  allowed_actions: z.enum(['all', 'local_only', 'selected']).optional(),
});
const workflow = z.object({
  default_workflow_permissions: z.enum(['read', 'write']),
  can_approve_pull_request_reviews: z.boolean(),
});
const observation = z.object({
  branch: z.string(),
  branchMetadata: z.unknown(),
  effectiveRules: z.unknown(),
  rulesets: z.unknown(),
  merge: z.unknown(),
  actions: z.unknown(),
  workflow: z.unknown(),
  acceptedCheck: z.unknown().optional(),
});

interface ProposedRule {
  type: string;
  parameters?: Record<string, unknown>;
}
const historyRules: ProposedRule[] = [
  { type: 'deletion' },
  { type: 'non_fast_forward' },
  { type: 'required_linear_history' },
  {
    type: 'pull_request',
    parameters: {
      allowed_merge_methods: ['rebase'],
      required_approving_review_count: 0,
      require_code_owner_review: false,
      require_last_push_approval: false,
    },
  },
];

function statusRule(binding: CheckBinding): ProposedRule {
  return {
    type: 'required_status_checks',
    parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: [{ context: binding.context, integration_id: binding.integrationId }],
    },
  };
}

/** Proposals never change existing settings, and remain disabled even after candidate acceptance. */
export function repositoryRulesetProposal(branch: string, acceptedCheck: CheckBinding | null) {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) ||
    branch.startsWith('refs/') ||
    branch.includes('..') ||
    branch.includes('//') ||
    branch.split('/').some((part) => part.endsWith('.lock') || part.endsWith('.')) ||
    branch.endsWith('/')
  )
    throw new Error(
      'Use an explicit branch name, without refs/heads/, patterns or invalid ref characters.',
    );
  const rules = structuredClone(historyRules);
  if (acceptedCheck) rules.push(statusRule(checkBinding.parse(acceptedCheck)));
  return {
    name: 'personal-standard',
    target: 'branch',
    enforcement: 'disabled',
    bypass_actors: [],
    conditions: { ref_name: { include: [`refs/heads/${branch}`], exclude: [] } },
    rules,
  };
}

function bypassFindings(rules: z.infer<typeof rule>[], details: unknown): PolicyFinding[] {
  const found: PolicyFinding[] = [];
  const parsed = z.array(detail).safeParse(details);
  const ids = new Set(rules.map((value) => value.ruleset_id));
  for (const id of ids) {
    const source = parsed.success ? parsed.data.find((value) => value.id === id) : undefined;
    if (source?.enforcement !== 'active' || source.target !== 'branch') {
      found.push({
        rule: 'ruleset-enforcement',
        message:
          'An effective rule has no verified active branch ruleset source; a matching name or disabled proposal is insufficient.',
      });
    } else if (source.bypass_actors === undefined) {
      found.push({
        rule: 'ruleset-bypass-unverified',
        message:
          'Ruleset bypass actors are hidden or unreadable; verify with write access rather than treating an omitted field as empty.',
      });
    } else if (source.bypass_actors.length > 0) {
      found.push({
        rule: 'ruleset-bypass',
        message:
          'An attached ruleset permits bypass actors; review the exception explicitly before claiming enforced policy.',
      });
    }
  }
  return found;
}

function branchFindings(effective: unknown, details: unknown, accepted: unknown): PolicyFinding[] {
  const found: PolicyFinding[] = [];
  const parsed = z.array(rule).safeParse(effective);
  if (!parsed.success) {
    found.push({
      rule: 'branch-rules-unverified',
      message:
        'Effective branch rules could not be established; unreadable or malformed discovery is not observed missing protection.',
    });
  } else {
    if (!matchesPinnedRules(parsed.data, { rules: historyRules }))
      found.push({
        rule: 'branch-rules',
        message:
          'Effective branch rules do not match the personal linear-history and solo-review policy.',
      });
    found.push(...bypassFindings(parsed.data, details));
  }
  const binding = checkBinding.safeParse(accepted);
  if (!binding.success) {
    found.push({
      rule: 'candidate-unverified',
      message:
        'The exact-candidate verification route and check publisher have not been accepted. Keep required-check proposals disabled.',
    });
  } else if (
    parsed.success &&
    !matchesPinnedRules(parsed.data, { rules: [statusRule(binding.data)] })
  ) {
    found.push({
      rule: 'check-publisher',
      message:
        'The required check is absent, non-strict or not bound to the accepted integration publisher; a context name alone is insufficient.',
    });
  }
  return found;
}

function settingsFindings(input: z.infer<typeof observation>): PolicyFinding[] {
  const found: PolicyFinding[] = [];
  const branch = z.object({ name: z.string() }).safeParse(input.branchMetadata);
  if (!branch.success || branch.data.name !== input.branch)
    found.push({
      rule: 'branch-unverified',
      message:
        'The selected branch does not have verified matching metadata. The effective-rules endpoint also answers for nonexistent branches.',
    });
  const methods = merge.safeParse(input.merge);
  if (!methods.success)
    found.push({
      rule: 'merge-unverified',
      message: 'Repository merge settings are unreadable or malformed.',
    });
  else if (
    methods.data.allow_merge_commit ||
    methods.data.allow_squash_merge ||
    !methods.data.allow_rebase_merge
  )
    found.push({
      rule: 'merge-methods',
      message:
        'Repository settings must allow rebase and disable merge commits and squash to preserve the approved linear commit history.',
    });
  const execution = actions.safeParse(input.actions);
  if (!execution.success)
    found.push({
      rule: 'actions-unverified',
      message: 'Actions execution permissions are unreadable or malformed.',
    });
  else if (!execution.data.enabled)
    found.push({
      rule: 'actions-disabled',
      message: 'Actions are disabled; an Actions verification route cannot be claimed available.',
    });
  const token = workflow.safeParse(input.workflow);
  if (!token.success)
    found.push({
      rule: 'actions-token-unverified',
      message: 'Default workflow token permissions are unreadable or malformed.',
    });
  else if (
    token.data.default_workflow_permissions !== 'read' ||
    token.data.can_approve_pull_request_reviews
  )
    found.push({
      rule: 'actions-token',
      message:
        'Default workflow tokens must be read-only and unable to approve pull requests; grant write permissions only in the jobs that need them.',
    });
  return found;
}

/** Evaluate observed settings without writing GitHub state or upgrading inaccessible evidence. */
export function inspectRepositoryPolicy(value: unknown): PolicyFinding[] {
  const parsed = observation.safeParse(value);
  if (!parsed.success)
    return [
      {
        rule: 'policy-unverified',
        message: 'Repository policy discovery is incomplete or malformed.',
      },
    ];
  return [
    ...branchFindings(parsed.data.effectiveRules, parsed.data.rulesets, parsed.data.acceptedCheck),
    ...settingsFindings(parsed.data),
  ];
}
