import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkContract } from '../packages/cli/src/lib/check/contract.mjs';
import { standard } from '../standard.config.ts';

const cli = `${standard.npmScope}/cli`;
const { version } = JSON.parse(
  await readFile(new URL('../packages/cli/package.json', import.meta.url), 'utf8'),
);

async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'standard-contract-'));
  try {
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
    await mkdir(path.join(root, 'apps/app'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), JSON.stringify({}));
    await writeFile(
      path.join(root, 'apps/app/package.json'),
      JSON.stringify({ dependencies: { [cli]: version } }),
    );
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("accepts the standard's packages at an exact release", () =>
  fixture(async (root) => {
    assert.deepEqual(checkContract({ cwd: root }).lines, []);
  }));

test("rejects the standard's packages at a range, a file, or a copy", () =>
  fixture(async (root) => {
    for (const range of [`^${version}`, 'file:../../somewhere/cli', 'latest']) {
      await writeFile(
        path.join(root, 'apps/app/package.json'),
        JSON.stringify({ dependencies: { [cli]: range } }),
      );
      const { ok, lines } = checkContract({ cwd: root });
      assert.equal(ok, false, range);
      assert.deepEqual(lines, [
        `apps/app/package.json pins "${cli}" to "${range}" instead of a release such as "${version}"`,
      ]);
    }
  }));

test('a repository may add catalog entries and is warned when it re-pins a shared one', () =>
  fixture(async (root) => {
    const catalog = JSON.parse(
      await readFile(new URL('../packages/cli/catalog.json', import.meta.url), 'utf8'),
    ).catalog;
    const workspace = (eslint) =>
      `packages:\n  - apps/*\ncatalog:\n  eslint: ${eslint}\n  left-pad: 1.3.0\n`;
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), workspace(catalog.eslint));
    assert.deepEqual(checkContract({ cwd: root }).lines, []);
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), workspace('^9.0.0'));
    const result = checkContract({ cwd: root });
    assert.equal(result.ok, true, 'a re-pinned shared entry only warns until v0.8.0');
    assert.deepEqual(result.lines, [
      `warning: pnpm-workspace.yaml pins "eslint" to "^9.0.0"; the standard's catalog has "${catalog.eslint}" (from v0.8.0 this fails)`,
    ]);
  }));
