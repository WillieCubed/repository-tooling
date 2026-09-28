import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import * as cliCopy from '../packages/cli/src/lib/standard.mjs';
import {
  commitScopes,
  marketplace,
  setupTokenVariable,
  sourceRepository,
  standard,
  stateDir,
} from '../standard.config.ts';

/**
 * standard.config.ts holds every owner value. The files that cannot import it at runtime carry
 * copies: the CLI, which runs from node_modules where Node does not strip types, and the shell
 * hooks, JSON, and plugin scripts. Each copy is checked here, so changing the owner is one edit
 * to the config followed by the edits these tests name.
 */

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const json = async (file) => JSON.parse(await read(file));
const examples = ['basic', 'with-astro', 'with-vite-react'];
const plugin = `packages/cli/plugins/${standard.pluginName}`;

test('the CLI carries the same owner values as standard.config.ts', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(cliCopy.standard)), standard);
  assert.equal(cliCopy.stateDir, stateDir);
  assert.equal(cliCopy.commitScopes, commitScopes);
  assert.equal(cliCopy.setupTokenVariable, setupTokenVariable);
  assert.equal(cliCopy.accessTeamDomain, `${standard.cloudflare.accessTeam}.cloudflareaccess.com`);
});

test('every package is published under the owner scope with the owner command', async () => {
  for (const name of await readdir(path.join(root, 'packages'))) {
    const manifest = await json(`packages/${name}/package.json`);
    assert.equal(manifest.name, `${standard.npmScope}/${name}`);
    assert.equal(manifest.repository.url, `https://github.com/${sourceRepository}.git`);
  }
  assert.deepEqual(Object.keys((await json('packages/cli/package.json')).bin), [standard.cliName]);
  assert.match(await read('.npmrc'), new RegExp(`^${standard.npmScope}:registry=`, 'm'));
});

test('the shell hooks and the plugin name the configured command and paths', async () => {
  assert.ok((await read('packages/cli/hooks/pre-commit.sh')).includes(`exec ${standard.cliName} `));
  assert.ok(
    (await read('packages/cli/hooks/commit-msg.sh')).includes(
      `plugins/${standard.pluginName}/scripts/`,
    ),
  );
  const validator = await read(`${plugin}/scripts/validate-commit-subject.mjs`);
  assert.ok(validator.includes(`'${commitScopes}'`), `the validator reads ${commitScopes}`);
  for (const harness of ['.claude-plugin', '.codex-plugin']) {
    const manifest = await json(`${plugin}/${harness}/plugin.json`);
    assert.equal(manifest.name, standard.pluginName);
    assert.equal(manifest.repository, `https://github.com/${sourceRepository}`);
  }
});

test('the marketplaces publish the plugin under the configured names', async () => {
  const claude = await json('.claude-plugin/marketplace.json');
  assert.equal(claude.name, marketplace);
  assert.equal(claude.plugins[0].name, standard.pluginName);
  assert.equal(claude.plugins[0].source, `./${plugin}`);
  for (const directory of ['.', ...examples.map((name) => `examples/${name}`)]) {
    const codex = await json(`${directory}/.agents/plugins/marketplace.json`);
    assert.equal(codex.name, marketplace, directory);
    assert.equal(codex.plugins[0].name, standard.pluginName, directory);
    assert.ok(codex.plugins[0].source.path.endsWith(`/${standard.pluginName}`), directory);
  }
});

test('each example names the owner in the files it cannot compute', async () => {
  for (const name of examples) {
    const example = `examples/${name}`;
    assert.match(
      await read(`${example}/.github/CODEOWNERS`),
      new RegExp(`^\\* @${standard.owner}$`, 'm'),
    );
    await read(`${example}/${commitScopes}`);
    const codex = await read(`${example}/.codex/hooks.json`);
    assert.ok(
      codex.includes(`node_modules/${standard.npmScope}/cli/plugins/${standard.pluginName}/`),
    );
    for (const hook of ['commit-msg', 'pre-commit', 'pre-push', 'prepare-commit-msg']) {
      const stub = await read(`${example}/.githooks/${hook}`);
      assert.ok(stub.includes(`node_modules/${standard.npmScope}/cli/hooks/${hook}.sh`), hook);
    }
    const update = await read(`${example}/.github/workflows/standard-update.yml`);
    assert.ok(update.includes(`${standard.vendorDir}/standards/self-update.ts`), name);
  }
});
