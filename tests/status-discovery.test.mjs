import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { standard, sourceRepository } from '../standard.config.ts';

const root = path.resolve(import.meta.dirname, '..');

async function inspect(
  t,
  mode = 'success',
  options = ['--repo', standard.owner + '/reports', '--packages'],
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'standard-status-discovery-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'gh');
  await writeFile(
    executable,
    `#!${process.execPath}
const args = process.argv.slice(2);
require('node:fs').appendFileSync(process.env.FIXTURE_LOG, JSON.stringify(args) + '\\n');
const output = (value) => process.stdout.write(JSON.stringify(value));
if (args[0] === 'repo' && args[1] === 'view') {
  if (process.env.FIXTURE_MODE === 'local') { process.stderr.write('no git remotes'); process.exitCode = 1; }
  else process.stdout.write('WillieCubed/reports');
} else if (args[0] === 'api' && args[1] === 'user') {
  if (process.env.FIXTURE_MODE === 'account') {
    process.stderr.write('gh: Resource not accessible (HTTP 403)'); process.exitCode = 1;
  } else output({ login: ${JSON.stringify(standard.owner)}, plan: { name: 'free' } });
} else if (args[0] === 'api' && args[1].startsWith('repos/') && args[1].split('/').length === 3) {
  if (process.env.FIXTURE_MODE === 'metadata') {
    process.stderr.write('gh: Not Found (HTTP 404)'); process.exitCode = 1;
  } else output({ owner: { type: 'User' }, visibility:
    ['private', 'account'].includes(process.env.FIXTURE_MODE) ? 'private' : 'public',
    default_branch: 'main', allow_merge_commit: false, allow_squash_merge: false, allow_rebase_merge: true });
} else if (args[0] === 'api' && args[1] === 'graphql') {
  output({ data: { repository: { refs: { nodes: [
    { name: 'v0.0.3', target: { committedDate: '2026-10-16T00:00:00Z' } }
  ] } } } });
} else if (args[0] === 'api' && args[1].endsWith('/rulesets')) {
  if (process.env.FIXTURE_MODE === 'rulesets' && (args[1].includes('/wpp/') || args[1].includes('/putin/'))) {
    process.stderr.write('gh: Not Found (HTTP 404)\\n');
    process.exitCode = 1;
  } else output([{ name: 'org-standard' }]);
} else if (args[0] === 'api' && args[1].includes('/rules/branches/')) {
  output([{ type: 'deletion', ruleset_id: 7 }]);
} else if (args[0] === 'api' && args[1].endsWith('/rulesets/7')) {
  output({ id: 7, target: 'branch', enforcement: 'active', bypass_actors: [] });
} else if (args[0] === 'api' && args[1].endsWith('/protection')) {
  output({ enforce_admins: { enabled: true } });
} else if (args[0] === 'api' && args[1].includes('/branches/')) {
  output({ name: decodeURIComponent(args[1].split('/').at(-1)) });
} else if (args[0] === 'api' && args[1].endsWith('/actions/permissions/workflow')) {
  if (process.env.FIXTURE_MODE === 'workflow') {
    process.stderr.write('gh: Forbidden (HTTP 403)'); process.exitCode = 1;
  } else output({ default_workflow_permissions: 'read', can_approve_pull_request_reviews: false });
} else if (args[0] === 'api' && args[1].endsWith('/actions/permissions')) {
  output({ enabled: true, allowed_actions: 'selected' });
} else if (args[0] === 'api' && args[1].includes('/contents/package.json')) {
  output({ devDependencies: { [${JSON.stringify(standard.npmScope + '/cli')}]: '0.0.3' } });
} else if (args[0] === 'api' && args[1].includes('/contents/.claude/settings.json')) {
  output({ extraKnownMarketplaces: { cube: { source: {
    repo: ${JSON.stringify(sourceRepository)}, ref: 'v0.0.3'
  } } } });
} else if (args[0] === 'api' && args[1].includes('/contents/')) {
  process.stdout.write('name: CI\\non:\\n  workflow_dispatch:\\n');
} else if (args[0] === 'pr' && args[1] === 'list') {
  if (process.env.FIXTURE_MODE === 'pulls' && args.includes(${JSON.stringify(standard.owner + '/reports')})) {
    process.stderr.write('gh: Forbidden (HTTP 403)'); process.exitCode = 1;
  } else output([]);
}
else { process.stderr.write('Unexpected fixture request'); process.exitCode = 2; }
`,
  );
  await chmod(executable, 0o755);
  await writeFile(path.join(directory, 'requests'), '');
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'standards/status.ts'), '--json', ...options],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}${path.delimiter}${process.env.PATH}`,
        GITHUB_STEP_SUMMARY: '',
        FIXTURE_LOG: path.join(directory, 'requests'),
        FIXTURE_MODE: mode,
      },
    },
  );
  return {
    result,
    requests: (await readFile(path.join(directory, 'requests'), 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  };
}

test('status works from an independent checkout without any project registration', async (t) => {
  const { result, requests } = await inspect(t, 'success', []);
  assert.notEqual(result.stdout.trim(), '', result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(
    output.states.map(({ repository }) => repository),
    [standard.owner + '/reports'],
  );
  assert.equal(output.states[0].packageChecks, false);
  assert.ok(requests.some((args) => args[0] === 'repo' && args[1] === 'view'));
  assert.ok(
    !requests.some(
      (args) => args[1] === 'graphql' || args[1]?.includes('/contents/') || args[0] === 'pr',
    ),
  );
});

test('an explicit target never reads unrelated projects or a central catalog', async (t) => {
  const { result, requests } = await inspect(t);
  const output = JSON.parse(result.stdout);
  assert.equal(output.states.length, 1);
  assert.equal(output.states[0].repository, standard.owner + '/reports');
  for (const args of requests.filter((args) => args[0] === 'api' && args[1].startsWith('repos/')))
    assert.ok(args[1].startsWith('repos/' + standard.owner + '/reports'));
});

test('an explicit branch routes content, rules and update queries to that branch', async (t) => {
  const { result, requests } = await inspect(t, 'success', [
    '--repo',
    standard.owner + '/wpp',
    '--branch',
    'putin-live',
    '--packages',
  ]);
  const state = JSON.parse(result.stdout).states[0];
  assert.equal(state.branch, 'putin-live');
  assert.equal(state.hostPolicy.branchMetadata.name, 'putin-live');
  const content = requests.filter((args) => args[0] === 'api' && args[1].includes('/contents/'));
  assert.equal(content.length, 4);
  assert.ok(content.every((args) => args[1].endsWith('?ref=putin-live')));
  assert.ok(
    requests.some((args) => args[0] === 'pr' && args[args.indexOf('--base') + 1] === 'putin-live'),
  );
  assert.equal(state.release, 'v0.0.3');
  assert.equal(state.pluginRef, 'v0.0.3');
});

test('discovery reads active rules, source bypasses, classic protection and token defaults', async (t) => {
  const { result, requests } = await inspect(t);
  const state = JSON.parse(result.stdout).states[0];
  assert.equal(state.hostPolicy.rulesets[0].id, 7);
  assert.deepEqual(state.hostPolicy.rulesets[0].bypass_actors, []);
  assert.equal(state.hostPolicy.classicProtection.enforce_admins.enabled, true);
  assert.equal(state.hostPolicy.workflow.default_workflow_permissions, 'read');
  for (const suffix of [
    '/rules/branches/main',
    '/rulesets/7',
    '/branches/main/protection',
    '/actions/permissions/workflow',
  ])
    assert.ok(requests.some((args) => args[1] === `repos/${standard.owner}/reports${suffix}`));
  assert.equal(state.hostPolicy.acceptedCheck, null);
});

test('permission failures remain unknown while an explicit target still returns a report', async (t) => {
  for (const mode of ['metadata', 'workflow', 'account', 'pulls']) {
    const { result } = await inspect(t, mode);
    assert.notEqual(result.stdout.trim(), '', result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(result.status, 1);
    if (mode === 'account') {
      assert.equal(output.states[0].github.plan, null);
      assert.ok(output.findings.some(({ rule }) => rule === 'ruleset-unverified'));
    } else assert.ok(output.findings.some(({ rule }) => rule === 'discovery'));
  }
});

test('Free private discovery reports unavailable enforcement without asking for publication', async (t) => {
  const { result } = await inspect(t, 'private');
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.states[0].github, {
    ownerType: 'User',
    visibility: 'private',
    plan: 'free',
  });
  assert.ok(output.findings.some(({ rule }) => rule === 'ruleset-unavailable'));
});

test('public proposals are disabled and omit unaccepted mandatory checks', async (t) => {
  const { result } = await inspect(t, 'success', [
    '--repo',
    standard.owner + '/wpp',
    '--branch',
    'putin-live',
    '--proposals',
  ]);
  const output = JSON.parse(result.stdout);
  assert.equal(output.proposals.length, 1);
  assert.equal(output.proposals[0].targetRepository, standard.owner + '/wpp');
  assert.equal(output.proposals[0].ruleset.enforcement, 'disabled');
  assert.deepEqual(output.proposals[0].ruleset.conditions.ref_name.include, [
    'refs/heads/putin-live',
  ]);
  assert.ok(
    !output.proposals[0].ruleset.rules.some(({ type }) => type === 'required_status_checks'),
  );
  assert.equal(result.status, 1);
});

test('Free private targets receive no unsupported public proposal', async (t) => {
  const { result } = await inspect(t, 'private', [
    '--repo',
    standard.owner + '/reports',
    '--proposals',
  ]);
  assert.deepEqual(JSON.parse(result.stdout).proposals, []);
});

test('a local-only checkout needs no catalog or remote to run its own native commands', async (t) => {
  const { result, requests } = await inspect(t, 'local', []);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No GitHub destination.*local.*commands/i);
  assert.ok(!requests.some((args) => args[0] === 'api'));
});

test('invalid explicit repository paths are rejected before making API requests', async (t) => {
  const { result, requests } = await inspect(t, 'success', ['--repo', '../unexpected']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /OWNER\/REPOSITORY/);
  assert.deepEqual(requests, []);
});
