import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import {
  BRANCH_PREFIX,
  compareReleases,
  latestRelease,
  pinnedRelease,
} from '../packages/cli/src/lib/self-update/release.mjs';
import { sourceRepository, standard } from '../standard.config.ts';
import { readHostPolicy } from './host-discovery.ts';
import { hostFindings, rulesetProposals } from './host-findings.ts';
const OWNER = standard.owner;

type Manifest = Parameters<typeof pinnedRelease>[0];

/** Days a repository may trail the latest release while its update pull request runs. */
export const GRACE_DAYS = 3;

interface StatusTarget {
  repository: string;
  branch?: string;
  packageChecks: boolean;
  requiredStatus: string;
}

export interface RepositoryState {
  name: string;
  repository?: string;
  packageChecks?: boolean;
  release: string | null;
  pluginRef: string | null;
  /** The repository runs `Standard update`, and `ci.yml` accepts the dispatch it sends. */
  selfUpdating: boolean;
  rulesets: string[] | null;
  updates: { number: number; headRefName: string; failing: boolean }[] | null;
  branch?: string;
  discoveryErrors?: string[];
  hostPolicy?: ReturnType<typeof readHostPolicy>;
  /** Account capability evidence; null means discovery could not establish it. */
  github?: {
    ownerType: string | null;
    visibility: string | null;
    plan: string | null;
  } | null;
}

export interface Finding {
  repository: string;
  rule: string;
  message: string;
}

export interface Release {
  tag: string;
  date: string;
}

/** Days since the first release the repository has not adopted, or 0 when it is current. */
export function daysBehind(release: string, releases: Release[], now: number): number {
  const missed = releases
    .filter(({ tag }) => compareReleases(tag, release) > 0)
    .sort((left, right) => compareReleases(left.tag, right.tag))[0];
  return missed ? (now - Date.parse(missed.date)) / 86_400_000 : 0;
}

function adoptionFindings(state: RepositoryState, releases: Release[], now: number): Finding[] {
  if (state.packageChecks === false) return [];
  const found: Finding[] = [];
  const add = (rule: string, message: string) =>
    found.push({ repository: state.name, rule, message });
  const latest = latestRelease(releases.map(({ tag }) => tag));

  if (state.release === null) {
    add(
      'release',
      `main pins no released \`${standard.npmScope}/cli\`; pin every \`${standard.npmScope}/*\` package to a release.`,
    );
  } else {
    const days = daysBehind(state.release, releases, now);
    if (days > GRACE_DAYS)
      add(
        'release',
        `on ${state.release} and behind ${latest ?? 'the latest release'} for ${Math.floor(days)} days.`,
      );
  }
  if (state.release && state.pluginRef !== state.release) {
    add(
      'plugin-ref',
      `.claude/settings.json pins the contribution plugin to ${state.pluginRef ?? 'nothing'}, not ${state.release}.`,
    );
  }
  if (!state.selfUpdating)
    add(
      'self-update',
      'it cannot update itself: copy .github/workflows/standard-update.yml from the example and give ci.yml a workflow_dispatch trigger.',
    );
  return found;
}

/**
 * Compares one repository with the releases and the organization settings. Pure, so the rules are
 * tested without GitHub.
 */
export function findings(state: RepositoryState, releases: Release[], now: number): Finding[] {
  const found: Finding[] = [];
  const add = (rule: string, message: string) =>
    found.push({ repository: state.name, rule, message });
  found.push(...adoptionFindings(state, releases, now));
  found.push(...hostFindings(state));
  for (const update of state.updates ?? []) {
    if (update.failing) add('update', `update pull request #${update.number} is failing Validate.`);
  }
  return found;
}

export function report(states: RepositoryState[], latest: string | null, open: Finding[]): string {
  const lines = [
    `# Repository standard status`,
    '',
    latest ? `Latest release: **${latest}**.` : 'Package adoption: not requested.',
    '',
    '| Repository | Release | Open update | Findings |',
    '| --- | --- | --- | --- |',
  ];
  for (const state of states) {
    const mine = open.filter(({ repository }) => repository === state.name);
    const updates =
      state.updates === null
        ? 'unknown'
        : state.updates.map(({ number }) => `#${number}`).join(', ') || '—';
    const summary = mine.map(({ message }) => message).join('<br>') || 'none';
    lines.push(
      `| ${state.name} | ${state.packageChecks === false ? 'not inspected' : (state.release ?? 'unreleased')} | ${updates} | ${summary} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

const gh = (args: string[]) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function readRaw(repository: string, file: string, branch?: string): string | null {
  try {
    return gh([
      'api',
      `repos/${repository}/contents/${file}${branch ? `?ref=${encodeURIComponent(branch)}` : ''}`,
      '-H',
      'Accept: application/vnd.github.raw',
    ]);
  } catch {
    return null;
  }
}

export function pluginRef(settings: string | null): string | null {
  if (!settings) return null;
  const parsed = JSON.parse(settings) as {
    extraKnownMarketplaces?: Record<string, { source?: { repo?: string; ref?: string } }>;
  };
  const marketplace = Object.values(parsed.extraKnownMarketplaces ?? {}).find(
    ({ source }) => source?.repo === sourceRepository,
  );
  return marketplace?.source?.ref ?? null;
}

type Discover = <T>(resource: string, read: () => T) => T | null;

function readUpdates(entry: StatusTarget, repository: string, discover: Discover) {
  const pulls = discover(
    'pull requests',
    () =>
      JSON.parse(
        gh([
          'pr',
          'list',
          '--repo',
          repository,
          '--base',
          entry.branch ?? 'main',
          '--state',
          'open',
          '--json',
          'number,headRefName,statusCheckRollup',
          '--limit',
          '100',
        ]),
      ) as {
        number: number;
        headRefName: string;
        statusCheckRollup: {
          name?: string;
          context?: string;
          conclusion?: string;
          state?: string;
        }[];
      }[],
  );
  return (
    pulls
      ?.filter(({ headRefName }) => headRefName.startsWith(BRANCH_PREFIX))
      .map(({ number, headRefName, statusCheckRollup }) => ({
        number,
        headRefName,
        failing: statusCheckRollup.some(
          (check) =>
            (check.name ?? check.context) === entry.requiredStatus &&
            ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT'].includes(
              check.conclusion ?? check.state ?? '',
            ),
        ),
      })) ?? null
  );
}

function githubCapabilities(
  metadata: { visibility?: string; owner?: { type?: string } } | null,
  account: { login?: string; plan?: { name?: string } } | null,
  owner: string,
): Exclude<RepositoryState['github'], undefined> {
  if (!metadata) return null;
  return {
    ownerType: metadata.owner?.type ?? null,
    visibility: metadata.visibility ?? null,
    plan: account?.login === owner ? (account.plan?.name ?? null) : null,
  };
}

function readAdoption(entry: StatusTarget, repository: string) {
  if (!entry.packageChecks) return { release: null, pluginRef: null, selfUpdating: false };
  const manifest = readRaw(repository, 'package.json', entry.branch);
  return {
    release: manifest ? pinnedRelease(JSON.parse(manifest) as Manifest) : null,
    pluginRef: pluginRef(readRaw(repository, '.claude/settings.json', entry.branch)),
    selfUpdating:
      readRaw(repository, '.github/workflows/standard-update.yml', entry.branch) !== null &&
      /^\s{2}workflow_dispatch:/m.test(
        readRaw(repository, '.github/workflows/ci.yml', entry.branch) ?? '',
      ),
  };
}

function readState(
  entry: StatusTarget,
  account: { login?: string; plan?: { name?: string } } | null,
): RepositoryState {
  const repository = entry.repository;
  const owner = repository.split('/')[0] ?? OWNER;
  const discoveryErrors: string[] = [];
  function discover<T>(resource: string, read: () => T): T | null {
    try {
      return read();
    } catch (error) {
      const status = /HTTP \d{3}/.exec(String(error))?.[0] ?? 'request failed';
      discoveryErrors.push(
        `${resource} discovery for ${repository}: ${status}; discovery is unknown and protection remains unverified. Check repository identity, visibility, token access and API support.`,
      );
      return null;
    }
  }
  const metadata = discover(
    'repository metadata',
    () =>
      JSON.parse(gh(['api', `repos/${repository}`])) as {
        visibility?: string;
        owner?: { type?: string };
        default_branch?: string;
      },
  );
  const branch = entry.branch ?? metadata?.default_branch ?? 'main';
  const hostPolicy = readHostPolicy(
    {
      repository,
      branch,
      merge: metadata,
      acceptedCheck: null,
    },
    (resource, endpoint, paginated) =>
      discover(resource, () => {
        const result: unknown = JSON.parse(
          gh(['api', endpoint, ...(paginated ? ['--paginate', '--slurp'] : [])]),
        );
        return paginated && Array.isArray(result) ? result.flat() : result;
      }),
  );
  const rulesets = discover('rulesets', () =>
    (JSON.parse(gh(['api', `repos/${repository}/rulesets`])) as { name: string }[]).map(
      ({ name }) => name,
    ),
  );
  const updates = entry.packageChecks
    ? readUpdates({ ...entry, branch }, repository, discover)
    : [];
  return {
    name: repository.split('/')[1] ?? repository,
    packageChecks: entry.packageChecks,
    repository,
    branch,
    hostPolicy,
    discoveryErrors,
    github: githubCapabilities(metadata, account, owner),
    ...readAdoption(entry, repository),
    rulesets,
    updates,
  };
}

function readReleases(): Release[] {
  const query = `query {
    repository(owner: "${OWNER}", name: "repository-tooling") {
      refs(refPrefix: "refs/tags/", first: 100) {
        nodes {
          name
          target {
            ... on Commit { committedDate }
            ... on Tag { target { ... on Commit { committedDate } } }
          }
        }
      }
    }
  }`;
  const nodes = (
    JSON.parse(gh(['api', 'graphql', '-f', `query=${query}`])) as {
      data: {
        repository: {
          refs: {
            nodes: {
              name: string;
              target: { committedDate?: string; target?: { committedDate?: string } };
            }[];
          };
        };
      };
    }
  ).data.repository.refs.nodes;
  return nodes
    .filter(({ name }) => /^v\d+\.\d+\.\d+$/.test(name))
    .map(({ name, target }) => ({
      tag: name,
      date: target.committedDate ?? target.target?.committedDate ?? '',
    }));
}

function targetRepository(selected: string | undefined): string {
  let repository = selected;
  if (repository === undefined) {
    try {
      repository = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
    } catch {
      throw new Error(
        'No GitHub destination could be identified. Local development and native commands remain independent; use --repo OWNER/REPOSITORY only when inspecting a selected remote.',
      );
    }
  }
  if (
    !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repository) ||
    ['.', '..'].includes(repository.split('/')[1] ?? '')
  )
    throw new Error('Use an explicit OWNER/REPOSITORY target.');
  return repository;
}

export async function main(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      repo: { type: 'string' },
      branch: { type: 'string' },
      packages: { type: 'boolean' },
      json: { type: 'boolean' },
      proposals: { type: 'boolean' },
    },
  });
  const target: StatusTarget = {
    repository: targetRepository(values.repo),
    ...(values.branch !== undefined ? { branch: values.branch } : {}),
    packageChecks: values.packages ?? false,
    requiredStatus: 'Validate',
  };
  const releases = target.packageChecks ? readReleases() : [];
  const latest = latestRelease(releases.map(({ tag }) => tag)) ?? null;
  if (target.packageChecks && !latest)
    throw new Error('repository-tooling has no stable release tag.');
  let account: { login?: string; plan?: { name?: string } } | null = null;
  try {
    account = JSON.parse(gh(['api', 'user'])) as typeof account;
  } catch {
    // A repository-scoped workflow token may not read the owner's private plan.
  }
  const states = [readState(target, account)];
  const open = states.flatMap((state) => findings(state, releases, Date.now()));
  const output =
    values.json || values.proposals
      ? `${JSON.stringify({ latest, states, findings: open, ...(values.proposals ? { proposals: rulesetProposals(states) } : {}) }, null, 2)}\n`
      : report(states, latest, open);
  process.stdout.write(output);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, report(states, latest, open));
  if (open.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
