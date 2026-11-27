import type { CheckBinding } from '../packages/web-platform/src/repository-policy.ts';

type Read = (resource: string, endpoint: string, paginated?: boolean) => unknown;

function activeRulesetIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('ruleset_id' in item)) return [];
    const id = item.ruleset_id;
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? [id] : [];
  });
  return [...new Set(ids)];
}

/** Capture host evidence separately from policy evaluation; failed reads stay unknown. */
export function readHostPolicy(
  target: {
    repository: string;
    branch: string;
    merge: unknown;
    acceptedCheck: CheckBinding | null;
  },
  read: Read,
) {
  const base = `repos/${target.repository}`;
  const branch = encodeURIComponent(target.branch);
  const effectiveRules = read('effective branch rules', `${base}/rules/branches/${branch}`, true);
  return {
    branch: target.branch,
    branchMetadata: read('branch metadata', `${base}/branches/${branch}`),
    merge: target.merge,
    effectiveRules,
    rulesets: activeRulesetIds(effectiveRules).map((id) =>
      read(`ruleset ${id} details and bypass actors`, `${base}/rulesets/${id}`),
    ),
    // A denied/404 classic-protection endpoint remains unknown. It is not proof of absence.
    classicProtection: read('classic branch protection', `${base}/branches/${branch}/protection`),
    actions: read('Actions execution permissions', `${base}/actions/permissions`),
    workflow: read('workflow token permissions', `${base}/actions/permissions/workflow`),
    acceptedCheck: target.acceptedCheck ?? null,
  };
}
