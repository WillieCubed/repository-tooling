import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { applyRelease, run } from '../packages/cli/src/lib/self-update/apply.mjs';
import { publishedRelease, repositoryEntry } from '../packages/cli/src/lib/self-update/index.mjs';
import { proposeRelease } from '../packages/cli/src/lib/self-update/propose.mjs';
import {
  compareReleases,
  isPatchUpdate,
  latestRelease,
  planOpenUpdates,
  pullRequestBody,
  pullRequestTitle,
  updateBranch,
} from '../packages/cli/src/lib/self-update/release.mjs';
import { standard } from '../standard.config.ts';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'packages/cli/src/cli.mjs');
const { version } = JSON.parse(
  await readFile(path.join(root, 'packages/cli/package.json'), 'utf8'),
);
const tag = `v${version}`;
const git = (directory, ...args) => run('git', args, directory);
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));

/** A runner that records every command and answers from a table of canned outputs. */
function fakeRunner(answers, fallback = () => '') {
  const calls = [];
  const runner = (command, args, cwd) => {
    const line = [command, ...args].join(' ');
    calls.push(line);
    for (const [pattern, answer] of answers) {
      if (!pattern.test(line)) continue;
      if (answer instanceof Error) throw answer;
      return typeof answer === 'function' ? answer(command, args, cwd) : answer;
    }
    return fallback(command, args, cwd);
  };
  return { calls, runner };
}

async function commitAll(directory, message) {
  git(directory, 'add', '-A');
  git(
    directory,
    '-c',
    'user.name=test',
    '-c',
    'user.email=test@example.org',
    'commit',
    '-qm',
    message,
  );
}

/** Sets every `@williecubed/*` pin and the plugin ref in a copied example to `release`. */
async function pinExample(directory, release) {
  for (const file of ['package.json', 'packages/example/package.json']) {
    const manifest = await json(path.join(directory, file));
    for (const field of ['dependencies', 'devDependencies'])
      for (const name of Object.keys(manifest[field] ?? {}))
        if (name.startsWith(`${standard.npmScope}/`)) manifest[field][name] = release.slice(1);
    await writeFile(path.join(directory, file), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const settings = path.join(directory, '.claude/settings.json');
  await writeFile(settings, (await readFile(settings, 'utf8')).replace(tag, release));
}

test('only a patch step merges itself', () => {
  assert.equal(isPatchUpdate('v0.4.5', 'v0.4.6'), true);
  assert.equal(isPatchUpdate('v0.4.5', 'v0.5.0'), false);
  assert.equal(isPatchUpdate('v0.4.5', 'v1.4.6'), false);
  assert.equal(isPatchUpdate(null, 'v0.4.6'), false);
  assert.equal(isPatchUpdate('v0.4.6', 'v0.4.6'), false);
  assert.match(
    pullRequestBody({ tag: 'v0.5.0', kind: 'consumer', automerge: false }),
    /a maintainer merges it/,
  );
});

test('releases compare by version, not by text', () => {
  assert.ok(compareReleases('v0.10.0', 'v0.9.9') > 0);
  assert.equal(compareReleases('v1.2.3', 'v1.2.3'), 0);
  assert.equal(latestRelease(['v0.4.5', 'v0.3.0-rc.15', 'v0.10.1', 'v0.4.10']), 'v0.10.1');
  assert.throws(() => updateBranch('v0.3.0-rc.1'), /stable release tag/);
});

test('the newest release comes from what GitHub Packages publishes', () => {
  const view = (output) => fakeRunner([[/^npm view /, output]]);
  const listed = view(JSON.stringify(['0.6.0', '0.7.0', '0.10.0-rc.1', '0.9.1']));
  assert.equal(publishedRelease('/nonexistent', listed.runner), 'v0.9.1');
  assert.deepEqual(listed.calls, [`npm view ${standard.npmScope}/cli versions --json`]);
  assert.equal(publishedRelease('/nonexistent', view('"0.7.0"').runner), 'v0.7.0');
  assert.throws(() => publishedRelease('/nonexistent', view('"0.7.0-rc.1"').runner), /no stable/);
});

test('an update supersedes older update pull requests and yields to newer ones', () => {
  const open = [
    { number: 1, headRefName: 'automation/repository-standard-v0.4.3' },
    { number: 2, headRefName: 'automation/repository-standard-v0.4.5' },
    { number: 3, headRefName: 'automation/repository-standard-v0.5.0' },
    { number: 4, headRefName: 'feat/something-else' },
  ];
  const plan = planOpenUpdates(open, 'v0.4.5');
  assert.deepEqual(
    plan.superseded.map(({ number }) => number),
    [1],
  );
  assert.deepEqual(
    plan.newer.map(({ number }) => number),
    [3],
  );
});

test('the update pull request follows the pull request template', () => {
  const body = pullRequestBody({ tag: 'v0.4.5', kind: 'consumer', automerge: true });
  assert.deepEqual(
    [...body.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading),
    ['TL;DR', 'Changes', 'Follow-ups and Next Work'],
  );
  assert.match(body, /release-0-4-5\.md/);
  assert.match(body, /merges itself once `Validate` passes/);
  assert.ok(body.includes(`\`${standard.cliName} update\``));
  assert.doesNotMatch(body, /<!--/);
  assert.match(pullRequestTitle('v0.4.5'), /^chore: /);
});

test('a template repository is regenerated from the example its name gives', () => {
  assert.deepEqual(repositoryEntry('template-with-astro', true), {
    name: 'template-with-astro',
    kind: 'template',
    example: 'with-astro',
  });
  assert.equal(repositoryEntry('wpp', false).kind, 'consumer');
});

test('a consumer moves every standard package to the release once, with its own update', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'standard-self-update-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const consumer = path.join(fixture, 'consumer');
  await cp(path.join(root, 'examples/basic'), consumer, { recursive: true });
  await pinExample(consumer, 'v0.1.0');
  // A repository's own token may not push workflow files, so a self-update leaves them alone.
  await rm(path.join(consumer, '.github/workflows/standard-update.yml'));
  git(consumer, 'init', '--quiet', '--initial-branch', 'main');
  await commitAll(consumer, 'init');

  // The installed release's own `cube update` is this checkout's.
  const { calls, runner } = fakeRunner(
    [
      [/^pnpm install/, ''],
      [/^pnpm exec /, (_command, _args, cwd) => run('node', [cli, 'update'], cwd)],
    ],
    run,
  );
  const entry = { name: 'consumer', kind: 'consumer' };
  const first = await applyRelease({ target: consumer, entry, tag, runner });
  assert.equal(first.changed, true);
  assert.equal(first.from, 'v0.1.0');
  assert.deepEqual(first.skippedWorkflows, ['.github/workflows/standard-update.yml']);
  const install = calls.indexOf('pnpm install --no-frozen-lockfile');
  const update = calls.indexOf(`pnpm exec ${standard.cliName} update`);
  const add = calls.indexOf('git add -A');
  assert.ok(install !== -1 && install < update && update < add, 'installs, updates, then commits');
  assert.equal(git(consumer, 'branch', '--show-current'), updateBranch(tag));
  assert.equal(git(consumer, 'log', '-1', '--format=%ae'), standard.bot.email);
  assert.equal(git(consumer, 'status', '--porcelain'), '');
  assert.ok(
    !git(consumer, 'show', '--name-only', '--format=', 'HEAD').includes('.github/workflows/'),
  );
  const manifest = await json(path.join(consumer, 'package.json'));
  assert.equal(manifest.devDependencies[`${standard.npmScope}/cli`], version);
  const library = await json(path.join(consumer, 'packages/example/package.json'));
  assert.equal(library.devDependencies[`${standard.npmScope}/eslint-config`], version);
  assert.match(
    await readFile(path.join(consumer, '.claude/settings.json'), 'utf8'),
    new RegExp(`"ref": "${tag}"`),
  );

  const again = await applyRelease({ target: consumer, entry, tag, runner });
  assert.deepEqual(again, { changed: false, from: tag, skippedWorkflows: [] });
  const older = await applyRelease({ target: consumer, entry, tag: 'v0.0.1', runner });
  assert.equal(older.changed, false);
  assert.match(older.reason ?? '', /newer than v0\.0\.1/);
});

test('a template is regenerated from its release and keeps its published lockfile', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'standard-self-update-template-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  // A release checkout: the publication script, the values it reads, and the example.
  const source = path.join(fixture, 'source');
  for (const file of ['standards/template-publication.ts', 'standard.config.ts', 'examples/basic'])
    await cp(path.join(root, file), path.join(source, file), { recursive: true });
  git(source, 'init', '--quiet', '--initial-branch', 'main');
  await commitAll(source, 'release');
  git(source, 'tag', tag);

  const template = path.join(fixture, 'template');
  await cp(path.join(root, 'examples/basic'), template, { recursive: true });
  await pinExample(template, 'v0.1.0');
  await writeFile(path.join(template, 'pnpm-lock.yaml'), 'lockfileVersion: published\n');
  await mkdir(path.join(template, '.github/workflows'), { recursive: true });
  await writeFile(path.join(template, '.github/workflows/ci.yml'), 'name: CI\n');
  git(template, 'init', '--quiet', '--initial-branch', 'main');
  await commitAll(template, 'init');

  const { calls, runner } = fakeRunner([[/^pnpm install/, '']], run);
  const entry = repositoryEntry('template-basic', true);
  const result = await applyRelease({ target: template, entry, tag, source, runner });
  assert.equal(result.changed, true);
  assert.deepEqual(result.skippedWorkflows, ['.github/workflows/ci.yml']);
  assert.ok(calls.includes('pnpm install --lockfile-only --no-frozen-lockfile'));
  assert.equal(
    await readFile(path.join(template, 'pnpm-lock.yaml'), 'utf8'),
    'lockfileVersion: published\n',
  );
  const manifest = await json(path.join(template, 'package.json'));
  assert.equal(manifest.devDependencies[`${standard.npmScope}/cli`], version);
  assert.equal(git(template, 'status', '--porcelain'), '');

  const republished = await applyRelease({ target: template, entry, tag, source, runner });
  assert.equal(republished.changed, false, 'the same release proposes nothing');
});

const entry = { name: 'example', kind: 'consumer' };
const options = (runner, overrides = {}) => ({
  target: '/nonexistent/target',
  entry,
  tag: 'v0.5.0',
  changed: false,
  from: 'v0.4.5',
  runner,
  ...overrides,
});
const openUpdate = JSON.stringify([
  { number: 7, headRefName: 'automation/repository-standard-v0.5.0' },
]);
const pinned = (cliVersion) =>
  JSON.stringify({ devDependencies: { [`${standard.npmScope}/cli`]: cliVersion } });

test('an unchanged checkout closes its update only when the default branch has the release', async () => {
  const behind = fakeRunner([
    [/^gh pr list --state open/, openUpdate],
    [/contents\/package\.json/, pinned('0.4.5')],
  ]);
  await proposeRelease(options(behind.runner));
  assert.ok(!behind.calls.some((call) => call.startsWith('gh pr close')));

  const current = fakeRunner([
    [/^gh pr list --state open/, openUpdate],
    [/contents\/package\.json/, pinned('0.5.0')],
  ]);
  await proposeRelease(options(current.runner));
  assert.ok(current.calls.some((call) => call.startsWith('gh pr close 7')));
});

test('a branch GitHub deleted is pushed afresh and a failed dispatch is reported, not thrown', async (t) => {
  const exitCode = process.exitCode;
  t.after(() => {
    process.exitCode = exitCode;
  });
  const { calls, runner } = fakeRunner([
    [/^gh pr list --state open/, '[]'],
    [/^git ls-remote --heads/, ''],
    [/^gh pr list --head/, JSON.stringify([{ number: 12 }])],
    [/^gh workflow run ci\.yml/, new Error('no workflow_dispatch trigger')],
  ]);
  const outcome = await proposeRelease(
    options(runner, { changed: true, from: 'v0.5.0', tag: 'v0.5.1' }),
  );
  assert.equal(outcome, 'example: #12');
  const forget = calls.findIndex((call) => call.startsWith('git update-ref -d'));
  const push = calls.findIndex((call) => call.startsWith('git push --force-with-lease'));
  assert.ok(forget !== -1 && forget < push, 'the stale tracking ref is forgotten before the push');
  assert.ok(calls.includes('gh pr merge 12 --auto --rebase'), 'a patch merges itself');
  assert.equal(process.exitCode, 1);
});

test('a new pull request is opened with the helper the repository installed', async () => {
  const { calls, runner } = fakeRunner([
    [/^gh pr list --state open/, '[]'],
    [/^git ls-remote --heads/, ''],
    [/^gh pr list --head/, '[]'],
    [/github-create\.mjs .* --json$/, JSON.stringify({ number: 21 })],
  ]);
  const outcome = await proposeRelease(options(runner, { changed: true }));
  assert.equal(outcome, 'example: #21');
  const helper = path.join(
    '/nonexistent/target/node_modules',
    standard.npmScope,
    'cli/plugins',
    standard.pluginName,
    'scripts/github-create.mjs',
  );
  assert.ok(
    calls.some(
      (call) => call.startsWith(`node ${helper} pr --title`) && call.endsWith('--dry-run'),
    ),
  );
  assert.ok(!calls.some((call) => call.startsWith('gh pr create')));
  assert.ok(!calls.some((call) => call.startsWith('gh pr merge')), 'a minor release waits');
});

test('every example updates itself with only its own workflow token', async () => {
  for (const example of ['basic', 'with-astro', 'with-vite-react']) {
    const directory = path.join(root, 'examples', example, '.github/workflows');
    const workflow = await readFile(path.join(directory, 'standard-update.yml'), 'utf8');
    assert.match(workflow, /^ {2}schedule:/m, example);
    assert.match(workflow, /^ {2}workflow_dispatch:/m, example);
    for (const permission of [
      'actions: write',
      'contents: write',
      'packages: read',
      'pull-requests: write',
    ])
      assert.match(workflow, new RegExp(`^ {2}${permission}$`, 'm'), `${example}: ${permission}`);
    assert.ok(workflow.includes(`run: pnpm exec ${standard.cliName} self-update`), example);
    assert.match(workflow, /NODE_AUTH_TOKEN: \$\{\{ github\.token \}\}/, example);
    assert.doesNotMatch(workflow, /secrets\./, example);
    const ci = await readFile(path.join(directory, 'ci.yml'), 'utf8');
    assert.match(ci, /^ {2}workflow_dispatch:$/m, `${example}: ci.yml must accept the dispatch`);
  }
});
