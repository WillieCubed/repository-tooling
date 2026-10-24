import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import {
  cfDeployArguments,
  deployArguments,
  deployables,
  wranglerDeployArguments,
} from '../packages/cli/src/lib/operate.mjs';

const commit = 'a'.repeat(40);
const cli = path.resolve(import.meta.dirname, '../packages/cli/src/cli.mjs');

const temporary = [];
after(async () => {
  for (const directory of temporary) await rm(directory, { recursive: true, force: true });
});

async function scratch(prefix) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), prefix)));
  temporary.push(directory);
  return directory;
}

/** Write each file, creating its directory, relative to root. */
async function files(root, contents) {
  for (const [file, content] of Object.entries(contents)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
}

test('a cf project deploys with cf deploy and records the commit on the Worker Version', () => {
  assert.deepEqual(cfDeployArguments(commit, false), [
    'exec',
    'cf',
    'deploy',
    '--message',
    `Commit ${commit}`,
  ]);
});

test('dry-run keeps provenance and adds the cf dry-run flag', () => {
  assert.deepEqual(cfDeployArguments(commit, true), [
    'exec',
    'cf',
    'deploy',
    '--message',
    `Commit ${commit}`,
    '--dry-run',
  ]);
});

test('a legacy Wrangler app records exact commit provenance and refuses conflicting remote changes', () => {
  assert.deepEqual(wranglerDeployArguments(commit, false), [
    'exec',
    'wrangler',
    'deploy',
    '--strict',
    '--message',
    `Commit ${commit}`,
  ]);
});

test('dry-run keeps provenance and adds the Wrangler dry-run flag', () => {
  assert.deepEqual(wranglerDeployArguments(commit, true), [
    'exec',
    'wrangler',
    'deploy',
    '--strict',
    '--message',
    `Commit ${commit}`,
    '--dry-run',
  ]);
});

test('deploy provenance requires a full Git commit for either tool', () => {
  assert.throws(() => cfDeployArguments('main', false), /full Git commit/);
  assert.throws(() => wranglerDeployArguments('main', false), /full Git commit/);
  assert.throws(() => cfDeployArguments('a'.repeat(39), true), /full Git commit/);
});

test('each deployable deploys with the tool its config belongs to', () => {
  assert.deepEqual(deployArguments('cf', commit, true), cfDeployArguments(commit, true));
  assert.deepEqual(
    deployArguments('wrangler', commit, false),
    wranglerDeployArguments(commit, false),
  );
});

test('deployables are cf projects and legacy wrangler apps, preferring cf when both exist', async () => {
  const root = await scratch('deployables-');
  await files(root, {
    'apps/both/cloudflare.config.ts': 'export default {};\n',
    'apps/both/wrangler.jsonc': '{}\n',
    'apps/cf/cloudflare.config.ts': 'export default {};\n',
    'apps/json/wrangler.json': '{}\n',
    'apps/legacy/wrangler.jsonc': '{}\n',
    'apps/library/package.json': '{}\n',
    'apps/toml/wrangler.toml': 'name = "toml"\n',
    'apps/cloudflare.config.ts': 'export default {};\n',
  });
  assert.deepEqual(await deployables(root), [
    { target: 'apps/both', tool: 'cf', config: 'cloudflare.config.ts' },
    { target: 'apps/cf', tool: 'cf', config: 'cloudflare.config.ts' },
    { target: 'apps/json', tool: 'wrangler', config: 'wrangler.json' },
    { target: 'apps/legacy', tool: 'wrangler', config: 'wrangler.jsonc' },
    { target: 'apps/toml', tool: 'wrangler', config: 'wrangler.toml' },
  ]);
});

test('the repository root is a deployable when it has a config, and comes first', async () => {
  const root = await scratch('deployables-root-');
  await files(root, {
    'cloudflare.config.ts': 'export default {};\n',
    'apps/site/wrangler.jsonc': '{}\n',
  });
  assert.deepEqual(await deployables(root), [
    { target: '.', tool: 'cf', config: 'cloudflare.config.ts' },
    { target: 'apps/site', tool: 'wrangler', config: 'wrangler.jsonc' },
  ]);
  assert.deepEqual(await deployables(await scratch('deployables-none-')), []);
});

/**
 * A committed repository with a cf app and a legacy app, and a pnpm that
 * records each call (its directory, then each argument) instead of running.
 */
async function deployableRepository() {
  const repository = await scratch('deploy-repository-');
  await files(repository, {
    'package.json': '{ "name": "deploy-fixture", "private": true }\n',
    'apps/site/cloudflare.config.ts': 'export default {};\n',
    'apps/site/wrangler.jsonc': '{}\n',
    'apps/legacy/wrangler.jsonc': '{}\n',
  });
  const git = (...args) => {
    const result = spawnSync(
      'git',
      [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.com',
        ...args,
      ],
      { cwd: repository, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');

  const bin = await scratch('deploy-bin-');
  const log = path.join(bin, 'calls.log');
  await writeFile(
    path.join(bin, 'pnpm'),
    `#!/bin/sh\n{ printf '%s' "$(pwd -P)"; for a in "$@"; do printf '\\t%s' "$a"; done; echo; } >> '${log}'\n`,
  );
  await chmod(path.join(bin, 'pnpm'), 0o755);

  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  delete env.GITHUB_SHA;
  const run = async (...args) => {
    await writeFile(log, '');
    const result = spawnSync(process.execPath, [cli, 'deploy', ...args], {
      cwd: repository,
      encoding: 'utf8',
      env,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return (await readFile(log, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => line.split('\t'));
  };
  return { repository, head: git('rev-parse', 'HEAD'), run };
}

test('cube deploy builds once, then runs cf deploy in a cf app and wrangler deploy in a legacy one', async () => {
  const { repository, head, run } = await deployableRepository();
  assert.deepEqual(await run('--dry-run'), [
    [repository, 'build'],
    [path.join(repository, 'apps/legacy'), ...wranglerDeployArguments(head, true)],
    [path.join(repository, 'apps/site'), ...cfDeployArguments(head, true)],
  ]);
  assert.deepEqual(await run('--filter', 'site'), [
    [repository, 'build'],
    [path.join(repository, 'apps/site'), 'exec', 'cf', 'deploy', '--message', `Commit ${head}`],
  ]);
});
