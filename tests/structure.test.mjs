import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { commitScopes, standard } from '../standard.config.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('the pull request template stays human-readable and exact', async () => {
  const template = await read('community-health/pull_request_template.md');
  assert.equal(
    template,
    `## TL;DR

## Changes

## Follow-ups and Next Work
`,
  );
  assert.doesNotMatch(template, /<!--/);
});

test('the issue forms require actionable information through native fields', async () => {
  const bug = await read('community-health/ISSUE_TEMPLATE/bug.yml');
  const feature = await read('community-health/ISSUE_TEMPLATE/feature.yml');
  const config = await read('community-health/ISSUE_TEMPLATE/config.yml');

  for (const field of ['reproduction', 'expected', 'actual']) {
    assert.match(bug, new RegExp(`id: ${field}`));
  }
  for (const field of ['problem', 'proposed-change']) {
    assert.match(feature, new RegExp(`id: ${field}`));
  }
  assert.match(bug, /labels:\n {2}- bug/);
  assert.match(feature, /labels:\n {2}- enhancement/);
  assert.match(config, /blank_issues_enabled: false/);
  assert.doesNotMatch(`${bug}\n${feature}`, /^title:\s*["']{2}\s*$/m);
  assert.doesNotMatch(`${bug}\n${feature}`, /transitmapper:|<!--/);
});

test('the organization registry contains every active repository', async () => {
  const registry = JSON.parse(await read('standards/repositories.json'));
  assert.deepEqual(registry.repositories.map(({ name }) => name).sort(), [
    '.github',
    'putin',
    'reports',
    'repository-tooling',
    'template-basic',
    'template-with-astro',
    'template-with-vite-react',
    'website',
    'wpp',
  ]);
  for (const entry of registry.repositories) {
    assert.ok(
      ['source', 'template', 'consumer'].includes(entry.kind),
      `${entry.name} needs a kind`,
    );
    assert.equal(entry.requiredStatus, 'Validate');
  }
  assert.deepEqual(
    registry.repositories.filter(({ kind }) => kind === 'source').map(({ name }) => name),
    ['repository-tooling'],
  );
  for (const exception of registry.exceptions) {
    assert.ok(
      registry.repositories.some(({ name }) => name === exception.repository),
      `exception names an unknown repository: ${exception.repository}`,
    );
    assert.ok(exception.rule && exception.reason, 'an exception needs a rule and a reason');
    assert.match(exception.expires, /^\d{4}-\d{2}-\d{2}$/, 'an exception needs an expiry date');
  }
});

// Releases before 0.6.0 belong to the upstream standard this repository was forked from, and their
// notes stay there; docs/reference/standard-config.md records the fork.
test('every stable release since 0.6.0 has release notes', async () => {
  const { version } = JSON.parse(await read('package.json'));
  const tags = execFileSync('git', ['-C', root, 'tag', '--list', 'v*'], { encoding: 'utf8' })
    .split('\n')
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
  const versions = new Set([version, ...tags.map((tag) => tag.slice(1))]);
  for (const release of versions) {
    const [major, minor] = release.split('.').map(Number);
    if (major === 0 && minor < 6) continue;
    await access(
      path.join(root, `docs/reference/release-${release.replaceAll('.', '-')}.md`),
    ).catch(() =>
      assert.fail(
        `release ${release} has no docs/reference/release-${release.replaceAll('.', '-')}.md`,
      ),
    );
  }
});

test('both harness manifests publish one plugin version', async () => {
  const plugin = `packages/cli/plugins/${standard.pluginName}`;
  const codex = JSON.parse(await read(`${plugin}/.codex-plugin/plugin.json`));
  const claude = JSON.parse(await read(`${plugin}/.claude-plugin/plugin.json`));
  assert.equal(codex.name, standard.pluginName);
  assert.equal(claude.name, codex.name);
  assert.equal(claude.version, codex.version);
});

test('the source repository uses the standard package-manager contract', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  const readme = await read('README.md');
  const agents = await read('AGENTS.md');

  assert.equal(packageJson.packageManager, 'pnpm@11.25.0');
  assert.equal(packageJson.scripts.bootstrap, `${standard.cliName} bootstrap`);
  assert.equal(packageJson.scripts.preflight, `${standard.cliName} preflight`);
  assert.equal(packageJson.scripts.build, 'pnpm check-types');
  // Tolerant of a missing .git so `npx github:<owner>/repository-tooling`
  // can install this package outside a checkout to bootstrap a new repository.
  assert.equal(
    packageJson.scripts.prepare,
    'git config --local core.hooksPath .githooks 2>/dev/null || true',
  );
  await access(path.join(root, 'pnpm-lock.yaml'));
  assert.match(readme, /pnpm check/);
  assert.doesNotMatch(readme, /npm run check/);
  assert.match(agents, /pnpm check/);
  assert.doesNotMatch(agents, /npm run check/);
});

test('continuous integration uses the same pnpm setup contract', async () => {
  const workflow = await read('.github/workflows/ci.yml');
  const setup = await read('.github/actions/setup-node-pnpm/action.yml');

  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-node-pnpm/);
  assert.match(workflow, /run: pnpm check/);
  assert.doesNotMatch(workflow, /npm run check/);
  assert.match(setup, /pnpm\/action-setup@/);
  assert.match(setup, /cache: pnpm/);
  assert.match(setup, /registry-url: https:\/\/npm\.pkg\.github\.com/);
  assert.ok(setup.includes(`scope: '${standard.npmScope}'`));
  assert.match(setup, /pnpm install --frozen-lockfile/);
  assert.match(setup, /NODE_AUTH_TOKEN: \$\{\{ github\.token \}\}/);
});

test('generated repositories authenticate GitHub Packages during installation', async () => {
  for (const profile of ['basic', 'with-astro', 'with-vite-react']) {
    const setup = await read(`examples/${profile}/.github/actions/setup-node-pnpm/action.yml`);
    assert.match(setup, /registry-url: https:\/\/npm\.pkg\.github\.com/);
    assert.ok(setup.includes(`scope: '${standard.npmScope}'`));
    assert.match(setup, /NODE_AUTH_TOKEN: \$\{\{ github\.token \}\}/);
  }
});

test('a standard update commits an installable lockfile', async () => {
  const apply = await read('packages/cli/src/lib/self-update/apply.mjs');

  assert.match(apply, /'install', '--lockfile-only', '--no-frozen-lockfile'/);
  assert.match(apply, /'install', '--no-frozen-lockfile'/);
  for (const install of ["'--lockfile-only'", "['install', '--no-frozen-lockfile']"])
    assert.ok(
      apply.indexOf(install) < apply.indexOf("'add', '-A'"),
      'the lockfile must be generated before the update commit',
    );
});

test('the source repository installs the shared commit-subject validator', async () => {
  const hook = await read('.githooks/commit-msg');
  const sharedHook = await read('packages/cli/hooks/commit-msg.sh');
  const prePush = await read('packages/cli/hooks/pre-push.sh');

  assert.match(hook, /packages\/cli\/hooks\/commit-msg\.sh/);
  assert.match(sharedHook, /validate-commit-message\.mjs/);
  assert.match(prePush, /pnpm check/);
});

test('the contribution policy leaves scopes to each repository', async () => {
  const agents = await read('AGENTS.md');
  const plugin = `packages/cli/plugins/${standard.pluginName}`;
  const skill = await read(`${plugin}/skills/github-contribution/SKILL.md`);
  const scopes = await read(commitScopes);
  const commitTypes = await read(`${plugin}/standards/commit-types.txt`);

  assert.match(agents, /commit scopes are optional/i);
  assert.ok(agents.includes(`\`${commitScopes}\``), `AGENTS.md names ${commitScopes}`);
  assert.match(agents, /the complete\s+list of durable boundaries for this repository/i);
  assert.doesNotMatch(agents, /rules may add to\s+the organization standard/i);
  assert.ok(skill.includes(commitScopes), `the skill names ${commitScopes}`);
  assert.match(scopes, /^tooling$/m);
  assert.match(commitTypes, /^feat$/m);
});

test('the workspace catalog is the same baseline the example ships', async () => {
  const workspace = await read('pnpm-workspace.yaml');
  const { catalog } = JSON.parse(await read('packages/cli/catalog.json'));
  const block = workspace.slice(workspace.indexOf('catalog:\n') + 'catalog:\n'.length);
  const entries = Object.fromEntries(
    block
      .split('\n')
      .map((line) => /^ {2}'?([^':]+)'?: (\S+)$/.exec(line))
      .filter(Boolean)
      .map(([, name, version]) => [name, version]),
  );
  assert.deepEqual(entries, catalog);
});

test('the ruleset requires only the repository Validate check', async () => {
  const ruleset = JSON.parse(await read('standards/ruleset.json'));
  const statusRule = ruleset.rules.find(({ type }) => type === 'required_status_checks');
  assert.deepEqual(statusRule.parameters.required_status_checks, [{ context: 'Validate' }]);
  assert.deepEqual(ruleset.bypass_actors, []);
});

test('source and generated repositories pin audited transitive fixes', async () => {
  for (const directory of [
    '.',
    'examples/basic',
    'examples/with-astro',
    'examples/with-vite-react',
  ]) {
    const workspace = await readFile(path.join(root, directory, 'pnpm-workspace.yaml'), 'utf8');
    assert.match(
      workspace,
      /^overrides:\n {2}sharp: 0\.35\.4\n {2}smol-toml: 1\.8\.0\n {2}svgo: 4\.1\.0$/m,
    );
  }
});
