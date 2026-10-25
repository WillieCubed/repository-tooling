import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { passRegistryTokenThroughTurbo } from '../packages/cli/src/lib/update/registry-token.mjs';

const sourceRoot = new URL('..', import.meta.url).pathname;

async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'standard-registry-token-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** The turbo.json every example shipped before the token passed through. */
const earlier = {
  $schema: 'https://turborepo.dev/schema.json',
  ui: 'tui',
  globalEnv: ['CI'],
  tasks: { build: { dependsOn: ['^build'] } },
};

test('the update passes the registry token through Turbo, after globalEnv', () =>
  fixture(async (root) => {
    const file = path.join(root, 'turbo.json');
    await writeFile(file, `${JSON.stringify(earlier, null, 2)}\n`);
    assert.deepEqual(await passRegistryTokenThroughTurbo(root, false), ['turbo.json']);
    const turbo = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(Object.keys(turbo), [
      '$schema',
      'ui',
      'globalEnv',
      'globalPassThroughEnv',
      'tasks',
    ]);
    assert.deepEqual(turbo.globalPassThroughEnv, ['NODE_AUTH_TOKEN']);
    assert.match(await readFile(file, 'utf8'), /"globalPassThroughEnv": \["NODE_AUTH_TOKEN"\]/);
  }));

test('a repository that passes the token through already, or keeps its own list, is respected', () =>
  fixture(async (root) => {
    const file = path.join(root, 'turbo.json');
    await writeFile(file, JSON.stringify({ ...earlier, globalPassThroughEnv: ['SENTRY_DSN'] }));
    await passRegistryTokenThroughTurbo(root, false);
    const once = await readFile(file, 'utf8');
    assert.deepEqual(JSON.parse(once).globalPassThroughEnv, ['SENTRY_DSN', 'NODE_AUTH_TOKEN']);
    assert.deepEqual(await passRegistryTokenThroughTurbo(root, false), []);
    assert.equal(await readFile(file, 'utf8'), once);
  }));

test('a dry run names turbo.json without writing it, and no turbo.json is no change', () =>
  fixture(async (root) => {
    assert.deepEqual(await passRegistryTokenThroughTurbo(root, true), []);
    const file = path.join(root, 'turbo.json');
    const text = `${JSON.stringify(earlier, null, 2)}\n`;
    await writeFile(file, text);
    assert.deepEqual(await passRegistryTokenThroughTurbo(root, true), ['turbo.json']);
    assert.equal(await readFile(file, 'utf8'), text);
  }));

test('every example already passes the registry token through', async () => {
  for (const name of ['basic', 'with-astro', 'with-vite-react']) {
    const turbo = JSON.parse(
      await readFile(path.join(sourceRoot, 'examples', name, 'turbo.json'), 'utf8'),
    );
    assert.ok(turbo.globalPassThroughEnv?.includes('NODE_AUTH_TOKEN'), name);
  }
});
