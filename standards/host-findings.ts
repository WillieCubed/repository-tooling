import {
  inspectRepositoryPolicy,
  repositoryRulesetProposal,
} from '../packages/web-platform/src/repository-policy.ts';
import type { Finding, RepositoryState } from './status.ts';

/** Keeps unavailable discovery distinct from an observed policy failure. */
function discoveryFindings(state: RepositoryState): Finding[] {
  const found = (state.discoveryErrors ?? []).map((message) => ({
    repository: state.name,
    rule: 'discovery',
    message,
  }));
  if (state.branch && state.hostPolicy === undefined)
    found.push({
      repository: state.name,
      rule: 'ruleset-scope',
      message: `Protection of branch ${state.branch} is unverified: repository ruleset names alone do not establish effective attachment and enforcement.`,
    });
  return found;
}

/** Feature availability is separate from whether a ruleset is attached and enforced. */
function rulesetAvailability(state: RepositoryState): boolean | null {
  if (state.github === undefined) return true; // Compatibility for legacy saved observations.
  if (!state.github) return null;
  const { ownerType, visibility, plan } = state.github;
  if (visibility === 'public') return true;
  if (visibility !== 'private') return null;
  if (ownerType === 'User') {
    if (plan === 'free') return false;
    return plan === 'pro' ? true : null;
  }
  if (ownerType === 'Organization') {
    if (plan === 'free') return false;
    return plan === 'team' || plan === 'enterprise' ? true : null;
  }
  return null;
}

function rulesetFindings(state: RepositoryState): Finding[] {
  const found: Finding[] = [];
  const add = (rule: string, message: string) =>
    found.push({ repository: state.name, rule, message });
  const supported = rulesetAvailability(state);
  if (supported === false)
    add(
      'ruleset-unavailable',
      'Host-enforced rulesets for this private repository are unavailable on GitHub Free; local hooks do not establish equivalent enforcement. Keep visibility unchanged and make any plan upgrade a separate owner decision.',
    );
  else if (supported === null)
    add(
      'ruleset-unverified',
      'Account plan or repository visibility is unknown; host ruleset availability remains unverified.',
    );
  else if (
    state.hostPolicy === undefined &&
    state.rulesets !== null &&
    !state.rulesets.includes('org-standard')
  )
    add('ruleset', 'the org-standard ruleset is missing.');
  else if (state.hostPolicy === undefined && state.github !== undefined && state.rulesets !== null)
    add(
      'ruleset-unverified',
      'A ruleset name alone does not establish active enforcement, branch attachment or required-check coverage.',
    );
  if (state.hostPolicy !== undefined)
    found.push(
      ...inspectRepositoryPolicy(state.hostPolicy)
        .filter(
          ({ rule }) => supported !== false || !/^(branch|ruleset|check-publisher)/.test(rule),
        )
        .map((finding) => ({ repository: state.name, ...finding })),
    );
  return found;
}

export function hostFindings(state: RepositoryState): Finding[] {
  return [...discoveryFindings(state), ...rulesetFindings(state)];
}

/** Public personal proposals are local output only. They never activate or patch a ruleset. */
export function rulesetProposals(states: RepositoryState[]) {
  return states.flatMap((state) => {
    if (
      state.github?.ownerType !== 'User' ||
      state.github.visibility !== 'public' ||
      !state.hostPolicy ||
      !state.repository
    )
      return [];
    return [
      {
        repository: state.name,
        targetRepository: state.repository,
        ruleset: repositoryRulesetProposal(state.hostPolicy.branch, state.hostPolicy.acceptedCheck),
      },
    ];
  });
}
