import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { standard } from '../standard.config.ts';
import { materializeTemplate } from '../standards/template-publication.ts';

const root = path.resolve(import.meta.dirname, '..');
const json = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

async function tree(directory, prefix = '') {
  const files = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const name = `${prefix}${entry.name}`;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(files, await tree(file, `${name}/`));
    else
      files[name] = {
        content: await readFile(file, 'utf8'),
        mode: (await stat(file)).mode & 0o777,
      };
  }
  return files;
}

test('browser templates type their Node.js test configuration', async () => {
  for (const [profile, app] of [
    ['with-astro', 'site'],
    ['with-vite-react', 'app'],
  ]) {
    const directory = `examples/${profile}/apps/${app}`;
    const manifest = await json(`${directory}/package.json`);
    const tsconfig = await json(`${directory}/tsconfig.json`);

    assert.equal(
      manifest.devDependencies?.['@types/node'],
      'catalog:',
      `${profile} must declare the Node.js types used by Playwright`,
    );
    assert.ok(
      tsconfig.compilerOptions?.types?.includes('node') ||
        tsconfig.compilerOptions?.types === undefined,
      `${profile} must not exclude Node.js types from Playwright`,
    );
  }
});

test('template publication respects protected branches through a reviewed pull request', async () => {
  const workflow = await readFile(
    path.join(root, 'examples/basic/.github/workflows/standard-update.yml'),
    'utf8',
  );
  const selfUpdate = await Promise.all(
    ['apply.mjs', 'propose.mjs', 'index.mjs'].map((file) =>
      readFile(path.join(root, 'packages/cli/src/lib/self-update', file), 'utf8'),
    ),
  );
  const code = selfUpdate.join('\n');

  assert.match(code, /github-create\.mjs/);
  assert.match(code, /'--body-file'/);
  assert.match(code, /'--base', 'main'/);
  assert.match(code, /'pr', 'list'/);
  assert.match(code, /'pr', 'edit'/);
  assert.match(code, /standards\/template-publication\.ts/);
  assert.ok(workflow.includes(`pnpm exec ${standard.cliName} self-update`));
  assert.doesNotMatch(`${workflow}\n${code}`, /HEAD:main/);
});

test('template publication copies one exact release and is byte-for-byte idempotent', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'standard-template-publication-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const { version } = await json('packages/cli/package.json');
  const release = `v${version}`;
  // A release checkout of the examples as they are in this working tree, so the test holds while a
  // release is being prepared as well as after it is committed.
  const source = path.join(fixture, 'source');
  await cp(path.join(root, 'examples'), path.join(source, 'examples'), { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', source, ...args], { stdio: 'ignore' });
  git('init', '--quiet', '--initial-branch', 'main');
  git('add', '--', 'examples');
  git(
    '-c',
    'user.name=test',
    '-c',
    'user.email=test@example.org',
    'commit',
    '--quiet',
    '-m',
    'release',
  );
  git('tag', release);

  for (const example of ['basic', 'with-astro', 'with-vite-react']) {
    const target = path.join(fixture, example);
    await mkdir(path.join(target, 'node_modules'), { recursive: true });
    await writeFile(path.join(target, 'node_modules/kept'), 'installed\n');
    await writeFile(path.join(target, 'stale.txt'), 'from an older release\n');
    await materializeTemplate({ source, target, example, release });

    const first = await tree(target);
    const { 'node_modules/kept': kept, ...copied } = first;
    assert.deepEqual(copied, await tree(path.join(source, 'examples', example)), example);
    assert.equal(kept?.content, 'installed\n', 'the installed dependencies stay');
    await materializeTemplate({ source, target, example, release });
    assert.deepEqual(await tree(target), first, `${example} publication must be idempotent`);
  }

  const other = { source, target: path.join(fixture, 'other'), example: 'basic' };
  await assert.rejects(
    materializeTemplate({ ...other, release: 'v99.0.0' }),
    /has no tag v99\.0\.0/,
  );
  git('tag', 'v99.0.0');
  await assert.rejects(materializeTemplate({ ...other, release: 'v99.0.0' }), (error) =>
    error.message.includes(`package.json pins ${standard.npmScope}/cli to ${version}`),
  );

  await writeFile(path.join(source, 'examples/basic/README.md'), 'unreleased change\n');
  await assert.rejects(
    materializeTemplate({
      source,
      target: path.join(fixture, 'dirty-source'),
      example: 'basic',
      release,
    }),
    /clean checkout of the requested release/,
  );
});
