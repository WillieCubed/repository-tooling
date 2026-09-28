import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkOwned } from '../packages/cli/src/lib/check/owned.mjs';
import { applyUpdate } from '../packages/cli/src/lib/update/index.mjs';
import {
  OWNED_FILES,
  SEEDED_FILES,
  release,
  standardCopy,
} from '../packages/cli/src/lib/update/standard-files.mjs';
import { standard } from '../standard.config.ts';

const root = path.resolve(import.meta.dirname, '..');
const examples = ['basic', 'with-astro', 'with-vite-react'];
const hooks = OWNED_FILES.filter((name) => name.startsWith('.githooks/'));
const executable = async (file) => ((await stat(file)).mode & 0o111) !== 0;

async function repository(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'standard-owned-files-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('every example carries the CLI copy of each file the standard writes', async () => {
  for (const name of [...OWNED_FILES, ...SEEDED_FILES]) {
    for (const example of examples) {
      const file = path.join(root, 'examples', example, name);
      assert.equal(await readFile(file, 'utf8'), standardCopy(name), `${example}/${name}`);
      if (hooks.includes(name)) assert.ok(await executable(file), `${example}/${name} runs`);
    }
  }
});

test('the CLI package publishes the files it writes', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'packages/cli/package.json'), 'utf8'));
  assert.ok(manifest.files.includes('repository'));
  const packed = JSON.parse(
    execFileSync('pnpm', ['pack', '--dry-run', '--json'], {
      cwd: path.join(root, 'packages/cli'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  ).files.map(({ path: file }) => file);
  for (const name of [...OWNED_FILES, ...SEEDED_FILES])
    assert.ok(packed.includes(`repository/${name}`), `the tarball carries ${name}`);
});

test('an update writes the owned files, seeds the rest once, and never rewrites a workflow', async (t) => {
  const directory = await repository(t);
  const everything = [...OWNED_FILES, ...SEEDED_FILES].sort();

  const planned = await applyUpdate(directory, { dryRun: true });
  assert.deepEqual(planned.written, everything);
  await assert.rejects(readFile(path.join(directory, '.editorconfig')), 'a dry run writes nothing');

  assert.deepEqual((await applyUpdate(directory)).written, everything);
  for (const name of everything)
    assert.equal(await readFile(path.join(directory, name), 'utf8'), standardCopy(name), name);
  // The package tarball drops file modes, so the update sets the hooks' itself.
  for (const name of hooks) assert.ok(await executable(path.join(directory, name)), name);
  assert.deepEqual(await applyUpdate(directory), { written: [], migrated: [], warnings: [] });

  const workflow = path.join(directory, SEEDED_FILES[0]);
  await writeFile(workflow, 'name: Standard update\n');
  await writeFile(path.join(directory, '.editorconfig'), 'root = false\n');
  await chmod(path.join(directory, hooks[0]), 0o644);
  assert.deepEqual((await applyUpdate(directory)).written, [hooks[0], '.editorconfig'].sort());
  assert.equal(await readFile(workflow, 'utf8'), 'name: Standard update\n');
  assert.equal(
    await readFile(path.join(directory, '.editorconfig'), 'utf8'),
    standardCopy('.editorconfig'),
  );
  assert.ok(await executable(path.join(directory, hooks[0])));
});

test('the plugin ref follows the installed release, and cube check owned fails on drift', async (t) => {
  const directory = await repository(t);
  await applyUpdate(directory);
  const clean = checkOwned({ cwd: directory });
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.lines, []);

  const settings = path.join(directory, '.claude/settings.json');
  await writeFile(settings, standardCopy('.claude/settings.json').replace(release, 'v0.1.0'));
  await writeFile(path.join(directory, '.editorconfig'), 'root = false\n');
  await chmod(path.join(directory, '.githooks/pre-push'), 0o644);
  await rm(path.join(directory, '.codex/hooks.json'));
  await writeFile(path.join(directory, 'prettier.config.js'), 'export default {};\n');
  await writeFile(path.join(directory, '.prettierrc.json'), '{}\n');
  const drift = checkOwned({ cwd: directory });
  assert.equal(drift.ok, false);
  assert.deepEqual(drift.lines, [
    '.githooks/pre-push is not executable.',
    '.codex/hooks.json is missing.',
    ".editorconfig differs from the standard's copy.",
    ".prettierrc.json replaces the organization's prettier.config.js.",
    `.claude/settings.json loads the contribution plugin from v0.1.0, not ${release}.`,
  ]);
  assert.ok(drift.fix.includes(`pnpm exec ${standard.cliName} update`));

  const updated = await applyUpdate(directory);
  assert.deepEqual(updated.migrated, ['.claude/settings.json']);
  assert.equal(await readFile(settings, 'utf8'), standardCopy('.claude/settings.json'));
  assert.deepEqual(checkOwned({ cwd: directory }).lines, [
    ".prettierrc.json replaces the organization's prettier.config.js.",
  ]);
});

test('a settings file that loads the plugin from elsewhere keeps its own marketplace', async (t) => {
  const directory = await repository(t);
  await mkdir(path.join(directory, '.claude'));
  const own = '{ "enabledPlugins": {} }\n';
  await writeFile(path.join(directory, '.claude/settings.json'), own);
  const { written, migrated } = await applyUpdate(directory);
  assert.ok(!written.includes('.claude/settings.json'));
  assert.deepEqual(migrated, []);
  assert.equal(await readFile(path.join(directory, '.claude/settings.json'), 'utf8'), own);
});
