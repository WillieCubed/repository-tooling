import assert from 'node:assert/strict';
import { test } from 'vitest';
import { inspectRepositoryPolicy, repositoryRulesetProposal } from '../src/repository-policy.ts';

const binding = { context: 'Validate', integrationId: 314 };
const rules = [
  { type: 'deletion', ruleset_id: 7 },
  { type: 'non_fast_forward', ruleset_id: 7 },
  { type: 'required_linear_history', ruleset_id: 7 },
  {
    type: 'pull_request',
    ruleset_id: 7,
    parameters: {
      allowed_merge_methods: ['rebase'],
      required_approving_review_count: 0,
      require_code_owner_review: false,
      require_last_push_approval: false,
    },
  },
  {
    type: 'required_status_checks',
    ruleset_id: 7,
    parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: [{ context: 'Validate', integration_id: 314 }],
    },
  },
];
const observed = () => ({
  branch: 'main',
  branchMetadata: { name: 'main' },
  merge: { allow_merge_commit: false, allow_squash_merge: false, allow_rebase_merge: true },
  effectiveRules: structuredClone(rules),
  rulesets: [{ id: 7, target: 'branch', enforcement: 'active', bypass_actors: [] }],
  actions: { enabled: true, allowed_actions: 'selected' },
  workflow: { default_workflow_permissions: 'read', can_approve_pull_request_reviews: false },
  acceptedCheck: binding,
});
const codes = (value: unknown) => inspectRepositoryPolicy(value).map(({ rule }) => rule);

test('active branch rules with explicit publisher and no bypasses satisfy repository policy', () => {
  assert.deepEqual(codes(observed()), []);
});

test('a ruleset name or disabled proposal never establishes effective enforcement', () => {
  assert.ok(codes({ ...observed(), effectiveRules: [] }).includes('branch-rules'));
  const input = observed();
  const first = input.rulesets[0];
  assert.ok(first);
  first.enforcement = 'disabled';
  assert.ok(codes(input).includes('ruleset-enforcement'));
});

test('hidden and present bypass actors remain distinct from verified empty bypasses', () => {
  const input = observed();
  assert.ok(
    codes({ ...input, rulesets: [{ id: 7, target: 'branch', enforcement: 'active' }] }).includes(
      'ruleset-bypass-unverified',
    ),
  );
  assert.ok(
    codes({
      ...input,
      rulesets: [{ ...input.rulesets[0], bypass_actors: [{ actor_type: 'User' }] }],
    }).includes('ruleset-bypass'),
  );
  assert.ok(codes({ ...input, rulesets: [] }).includes('ruleset-enforcement'));
});

test('checks require accepted candidate evidence and the exact publisher binding', () => {
  assert.ok(codes({ ...observed(), acceptedCheck: null }).includes('candidate-unverified'));
  const input = observed();
  const checks = input.effectiveRules[4]?.parameters;
  assert.ok(checks && 'required_status_checks' in checks);
  checks.required_status_checks = [{ context: 'Validate', integration_id: 999 }];
  assert.ok(codes(input).includes('check-publisher'));
  assert.ok(
    codes({ ...observed(), acceptedCheck: { context: 'Validate', integrationId: 0 } }).includes(
      'candidate-unverified',
    ),
  );
});

test('merge methods and token defaults are checked independently of branch rules', () => {
  const input = observed();
  assert.ok(
    codes({ ...input, merge: { ...input.merge, allow_merge_commit: true } }).includes(
      'merge-methods',
    ),
  );
  assert.ok(
    codes({
      ...input,
      workflow: { default_workflow_permissions: 'write', can_approve_pull_request_reviews: true },
    }).includes('actions-token'),
  );
  assert.ok(codes({ ...input, actions: { enabled: false } }).includes('actions-disabled'));
});

test('missing or malformed discovery is unverified rather than a pass', () => {
  for (const field of ['merge', 'effectiveRules', 'actions', 'workflow']) {
    assert.ok(codes({ ...observed(), [field]: null }).some(({ length }) => length > 0));
    assert.ok(codes({ ...observed(), [field]: 'unexpected' }).length > 0);
  }
});

test('rules matching a nonexistent branch do not establish protection of a real target', () => {
  assert.ok(codes({ ...observed(), branchMetadata: null }).includes('branch-unverified'));
  assert.ok(
    codes({ ...observed(), branchMetadata: { name: 'other' } }).includes('branch-unverified'),
  );
});

test('per-branch proposals are disabled and do not require unavailable solo reviewers', () => {
  const proposal = repositoryRulesetProposal('putin-live', null);
  assert.equal(proposal.enforcement, 'disabled');
  assert.deepEqual(proposal.conditions.ref_name.include, ['refs/heads/putin-live']);
  assert.deepEqual(proposal.bypass_actors, []);
  assert.ok(!proposal.rules.some(({ type }) => type === 'required_status_checks'));
  const pull = proposal.rules.find(({ type }) => type === 'pull_request');
  assert.equal(pull?.parameters?.required_approving_review_count, 0);
  const bound = repositoryRulesetProposal('main', binding);
  assert.equal(bound.enforcement, 'disabled', 'accepted route alone does not activate a proposal');
  const check = bound.rules.find(({ type }) => type === 'required_status_checks');
  assert.deepEqual(check?.parameters?.required_status_checks, [
    { context: 'Validate', integration_id: 314 },
  ]);
  for (const branch of ['', '*', 'main\nmalformed', 'refs/heads/main'])
    assert.throws(() => repositoryRulesetProposal(branch, null));
});
