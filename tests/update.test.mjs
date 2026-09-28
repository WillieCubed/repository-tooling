import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { applyUpdate } from '../packages/cli/src/lib/update/index.mjs';
import { LEGACY_SCOPE } from '../packages/cli/src/lib/update/legacy-scope.mjs';
import { release } from '../packages/cli/src/lib/update/standard-files.mjs';
import { standard } from '../standard.config.ts';

const cli = path.resolve(import.meta.dirname, '../packages/cli/src/cli.mjs');

async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'standard-update-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('migrates only legacy platform package references', () =>
  fixture(async (root) => {
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        dependencies: {
          [`${LEGACY_SCOPE}/brand`]: 'workspace:*',
          [`${LEGACY_SCOPE}/cli`]: '0.5.1',
        },
      }),
    );
    await writeFile(
      path.join(root, 'prettier.config.mjs'),
      `import '${LEGACY_SCOPE}/prettier-config';\n`,
    );
    const { migrated } = await applyUpdate(root);
    assert.deepEqual(migrated, ['package.json', 'prettier.config.mjs']);
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(manifest.dependencies), [
      `${LEGACY_SCOPE}/brand`,
      `${standard.npmScope}/cli`,
    ]);
    assert.equal(
      await readFile(path.join(root, 'prettier.config.mjs'), 'utf8'),
      `import '${standard.npmScope}/prettier-config';\n`,
    );
  }));

test('adds missing Playwright output rules to the repository .gitignore once', () =>
  fixture(async (root) => {
    const own = 'node_modules/\n# The site keeps its own test results.\ntest-results/';
    await writeFile(path.join(root, '.gitignore'), own);
    execFileSync('git', ['init', '--quiet', root]);
    const ignored = (file) =>
      spawnSync('git', ['-C', root, 'check-ignore', '--quiet', file]).status === 0;

    const planned = await applyUpdate(root, { dryRun: true });
    assert.deepEqual(planned.migrated, ['.gitignore']);
    assert.equal(await readFile(path.join(root, '.gitignore'), 'utf8'), own);

    const applied = await applyUpdate(root);
    assert.deepEqual(applied.migrated, ['.gitignore']);
    const updated = await readFile(path.join(root, '.gitignore'), 'utf8');
    assert.ok(updated.startsWith(`${own}\n`), 'the repository keeps its own lines');
    assert.equal(updated.split('\n').filter((line) => line === 'test-results/').length, 1);
    for (const file of [
      'apps/site/test-results/home-desktop/trace.zip',
      'apps/site/playwright-report/index.html',
      'apps/site/blob-report/report.zip',
      'apps/site/playwright/.cache/index.js',
    ]) {
      assert.ok(ignored(file), `${file} must be ignored`);
    }
    assert.ok(!ignored('apps/site/tests/e2e/home.spec.ts'), 'tests stay tracked');

    const repeated = await applyUpdate(root);
    assert.deepEqual(repeated.migrated, []);
    assert.equal(await readFile(path.join(root, '.gitignore'), 'utf8'), updated);
  }));

test('cube update lists what it would write and writes it only without --dry-run', () =>
  fixture(async (root) => {
    const run = (...args) =>
      spawnSync(process.execPath, [cli, 'update', ...args], { cwd: root, encoding: 'utf8' });
    const planned = run('--dry-run');
    assert.equal(planned.status, 0, planned.stderr);
    assert.match(planned.stdout, /write {5}\.editorconfig/);
    assert.match(planned.stdout, /nothing was written/);
    await assert.rejects(readFile(path.join(root, '.editorconfig')));

    const applied = run();
    assert.equal(applied.status, 0, applied.stderr);
    assert.match(applied.stdout, /wrote {5}\.editorconfig/);
    assert.ok(await readFile(path.join(root, '.editorconfig'), 'utf8'));
    const again = run();
    assert.match(
      again.stdout,
      new RegExp(`already on the ${release.replaceAll('.', '\\.')} standard`),
    );
  }));

test('cube update names a file it cannot read and changes nothing', () =>
  fixture(async (root) => {
    await writeFile(path.join(root, '.markdownlint-cli2.jsonc'), '{ "ignores": ["dist }');
    const result = spawnSync(process.execPath, [cli, 'update'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unclosed string\. Nothing was changed\./);
    await assert.rejects(readFile(path.join(root, '.editorconfig')));
  }));
