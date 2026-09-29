import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

async function workflow(directory = '.') {
  return readFile(path.join(root, directory, '.github/workflows/ci.yml'), 'utf8');
}

test('source repository validates each pull request commit once', async () => {
  const source = await workflow();
  assert.match(source, /^ {2}pull_request:$/m);
  assert.doesNotMatch(source, /^ {2}push:$/m);
});

for (const name of ['basic', 'with-astro', 'with-vite-react']) {
  test(`${name}: validates each pull request commit once`, async () => {
    const template = await workflow(path.join('examples', name));
    assert.match(template, /^ {2}pull_request:$/m);
    assert.doesNotMatch(template, /^ {2}push:$/m);
    assert.match(template, /^ {2}workflow_call:$/m);
    assert.match(template, /^ {2}workflow_dispatch:$/m);
  });
}

// Every workflow that installs dependencies reads @williecubed/* from GitHub Packages with the
// workflow's own token, which has no package access unless the workflow grants it.
for (const name of ['basic', 'with-astro', 'with-vite-react']) {
  test(`${name}: every workflow that installs can read GitHub Packages`, async () => {
    const directory = path.join(root, 'examples', name, '.github/workflows');
    const files = (await readdir(directory)).filter((file) => file.endsWith('.yml'));
    for (const file of files) {
      const source = await readFile(path.join(directory, file), 'utf8');
      if (!/setup-node-pnpm|pnpm install/.test(source)) continue;
      assert.match(
        source,
        /^ {2}packages: (?:read|write)$/m,
        `${name}/${file} needs packages: read`,
      );
    }
  });
}

// A repository created from a template pushes to main before production has a deploy token, so
// the deploy must skip with a notice instead of failing.
for (const name of ['with-astro', 'with-vite-react']) {
  test(`${name}: deploy skips cleanly until the deploy token exists`, async () => {
    const source = await readFile(
      path.join(root, 'examples', name, '.github/workflows/deploy.yml'),
      'utf8',
    );
    const steps = source
      .slice(source.indexOf('    steps:\n'))
      .split(/^ {6}- /m)
      .slice(1);
    assert.match(steps[0] ?? '', /secrets\.CLOUDFLARE_API_TOKEN/);
    for (const step of steps.slice(1)) {
      assert.match(step, /if: steps\.token\.outputs\.present == 'true'/, step.split('\n')[0]);
    }
  });
}
