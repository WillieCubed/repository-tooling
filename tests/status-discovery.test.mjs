import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { standard, sourceRepository } from '../standard.config.ts';

const root = path.resolve(import.meta.dirname, '..');

async function inspect(t, mode = 'rulesets') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'standard-status-discovery-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'gh');
  await writeFile(
    executable,
    `#!${process.execPath}
const args = process.argv.slice(2);
require('node:fs').appendFileSync(process.env.FIXTURE_LOG, JSON.stringify(args) + '\\n');
const output = (value) => process.stdout.write(JSON.stringify(value));
if (args[0] === 'api' && args[1] === 'graphql') {
  output({ data: { repository: { refs: { nodes: [
    { name: 'v0.0.3', target: { committedDate: '2026-10-16T00:00:00Z' } }
  ] } } } });
} else if (args[0] === 'api' && args[1].endsWith('/rulesets')) {
  if (process.env.FIXTURE_MODE === 'rulesets' && (args[1].includes('/wpp/') || args[1].includes('/putin/'))) {
    process.stderr.write('gh: Not Found (HTTP 404)\\n');
    process.exitCode = 1;
  } else output([{ name: 'org-standard' }]);
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
  const result = spawnSync(process.execPath, ['standards/status.ts', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}${path.delimiter}${process.env.PATH}`,
      GITHUB_STEP_SUMMARY: '',
      FIXTURE_LOG: path.join(directory, 'requests'),
      FIXTURE_MODE: mode,
    },
  });
  return {
    result,
    requests: (await readFile(path.join(directory, 'requests'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line)),
  };
}

test('unavailable ruleset discovery reports unknown protection without losing other repositories', async (t) => {
  const { result } = await inspect(t);
  assert.notEqual(
    result.stdout.trim(),
    '',
    'discovery failure must still produce the complete report',
  );
  const output = JSON.parse(result.stdout);
  assert.equal(result.status, 1, 'unknown protection must not pass the status gate');
  assert.ok(
    output.states.some(({ name }) => name === 'reports'),
    'other repositories are still inspected',
  );
  const unknown = output.findings.filter(({ repository }) => repository === 'wpp');
  assert.ok(
    unknown.some(
      ({ rule, message }) => rule === 'discovery' && /rulesets.*HTTP 404/i.test(message),
    ),
  );
  assert.ok(
    !unknown.some(({ rule }) => rule === 'ruleset'),
    'unreadable rulesets are not an observed missing ruleset',
  );
  assert.match(result.stdout, /protection.*unverified/i);
});

test('branch aliases route every content read and update PR query to the selected target', async (t) => {
  const { result, requests } = await inspect(t, 'success');
  const output = JSON.parse(result.stdout);
  assert.ok(!requests.some((args) => args.some((arg) => arg.includes('/putin/'))));
  const content = requests.filter(
    (args) =>
      args[0] === 'api' && args[1].includes('/contents/') && args[1].endsWith('?ref=putin-live'),
  );
  assert.equal(content.length, 4);
  assert.ok(content.every((args) => args[1].startsWith(`repos/${standard.owner}/wpp/`)));
  assert.ok(
    requests.some(
      (args) =>
        args[0] === 'pr' &&
        args.includes(`${standard.owner}/wpp`) &&
        args[args.indexOf('--base') + 1] === 'putin-live',
    ),
  );
  const state = output.states.find(({ name }) => name === 'putin');
  assert.equal(state.release, 'v0.0.3');
  assert.equal(state.pluginRef, 'v0.0.3');
  assert.equal(state.selfUpdating, true);
  assert.ok(
    output.findings.some(
      ({ repository, rule }) => repository === 'putin' && rule === 'ruleset-scope',
    ),
  );
  assert.equal(
    result.status,
    1,
    'a matching ruleset name does not prove protection of the selected branch',
  );
});

test('unavailable PR discovery retains observed rulesets and continues other repositories', async (t) => {
  const { result } = await inspect(t, 'pulls');
  const output = JSON.parse(result.stdout);
  const state = output.states.find(({ name }) => name === 'reports');
  assert.deepEqual(state.rulesets, ['org-standard']);
  assert.equal(state.updates, null);
  assert.ok(
    output.findings.some(
      ({ repository, rule, message }) =>
        repository === 'reports' && rule === 'discovery' && /pull requests.*HTTP 403/.test(message),
    ),
  );
  assert.ok(output.states.find(({ name }) => name === 'website'));
  assert.equal(result.status, 1);
});
