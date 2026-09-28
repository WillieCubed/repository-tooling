import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { packageDirectories } from '../check/contract.mjs';
import { readJson } from '../files.mjs';
import { standard } from '../standard.mjs';
import {
  commitMessage,
  compareReleases,
  parseRelease,
  pinnedRelease,
  updateBranch,
} from './release.mjs';

/** Runs a command and returns its trimmed output; git, gh, npm, and pnpm all run through this. */
export const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();

const WORKFLOWS = '.github/workflows';
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/** Writes a file for git or gh to read, outside the checkout so no repository check sees it. */
export async function withTemporaryFile(content, use) {
  const directory = await mkdtemp(path.join(os.tmpdir(), `${standard.cliName}-update-`));
  try {
    const file = path.join(directory, 'content');
    await writeFile(file, content);
    return await use(file);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function workspaceManifests(root) {
  const directories = existsSync(path.join(root, 'pnpm-workspace.yaml'))
    ? packageDirectories(root)
    : [];
  return ['.', ...directories].map((directory) => path.join(root, directory, 'package.json'));
}

/** Sets each exact `@williecubed/*` version in one manifest to `version`; true when one changed. */
function pinManifest(manifest, version) {
  let edited = false;
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = manifest[field] ?? {};
    for (const [name, range] of Object.entries(dependencies)) {
      if (!name.startsWith(`${standard.npmScope}/`) || !EXACT_VERSION.test(range)) continue;
      edited ||= range !== version;
      dependencies[name] = version;
    }
  }
  return edited;
}

/**
 * Pins every exact `@williecubed/*` dependency in the workspace to `version`. Returns the manifests
 * it changed.
 */
export async function pinStandardPackages(root, version) {
  const changed = [];
  for (const file of workspaceManifests(root)) {
    const manifest = await readJson(file);
    if (!pinManifest(manifest, version)) continue;
    // Prettier prints package.json exactly as JSON.stringify does.
    await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
    changed.push(path.relative(root, file));
  }
  return changed;
}

/**
 * Moves a repository's standard packages to the release, installs it, and runs that release's own
 * `cube update`, so the release's migrations apply in the same update.
 */
async function updateConsumer({ target, tag, runner }) {
  await pinStandardPackages(target, tag.slice(1));
  runner('pnpm', ['install', '--no-frozen-lockfile'], target);
  const output = runner('pnpm', ['exec', standard.cliName, 'update'], target);
  if (output) process.stdout.write(`${output}\n`);
}

/**
 * Regenerates a template repository from its example with the release's own publication script.
 * Publication rebuilds the lockfile too; keeping the published one makes pnpm resolve only what the
 * release changed, so a re-run with no new release proposes nothing.
 */
async function publishTemplate({ source, target, entry, tag, runner }) {
  if (!entry.example) throw new Error(`${entry.name} is a template without an example.`);
  const lockfile = path.join(target, 'pnpm-lock.yaml');
  const published = existsSync(lockfile) ? await readFile(lockfile, 'utf8') : undefined;
  runner(
    'node',
    [
      path.join(source, 'standards/template-publication.ts'),
      '--source',
      source,
      '--target',
      target,
      '--example',
      entry.example,
      '--release',
      tag,
    ],
    target,
  );
  if (published !== undefined) await writeFile(lockfile, published);
  runner('pnpm', ['install', '--lockfile-only', '--no-frozen-lockfile'], target);
}

/**
 * A repository's own GITHUB_TOKEN may not push workflow files, so a self-update leaves them as they
 * are and reports which ones the release changed; a maintainer copies those by hand.
 */
function restoreWorkflows(target, runner) {
  const changed = [
    ...runner('git', ['diff', '--name-only', 'HEAD', '--', WORKFLOWS], target).split('\n'),
    ...runner('git', ['ls-files', '--others', '--exclude-standard', '--', WORKFLOWS], target).split(
      '\n',
    ),
  ]
    .filter(Boolean)
    .sort();
  if (changed.length === 0) return [];
  runner('git', ['checkout', '--quiet', 'HEAD', '--', WORKFLOWS], target);
  runner('git', ['clean', '--quiet', '--force', '--', WORKFLOWS], target);
  return changed;
}

async function commit(target, tag, runner) {
  runner('git', ['switch', '-C', updateBranch(tag)], target);
  runner('git', ['restore', '--staged', '.'], target);
  runner('git', ['add', '-A'], target);
  await withTemporaryFile(commitMessage(tag), (message) =>
    runner(
      'git',
      [
        '-c',
        `user.name=${standard.bot.name}`,
        '-c',
        `user.email=${standard.bot.email}`,
        'commit',
        '--quiet',
        '--no-verify',
        '-F',
        message,
      ],
      target,
    ),
  );
}

/**
 * Applies a release to one checked-out repository and commits the result on the release's update
 * branch. A template is regenerated from `source`, a checkout of the release; every other
 * repository installs the release's packages. Returns `changed: false` when the repository already
 * matches, and a `reason` when it is on a newer release.
 */
export async function applyRelease({ target, entry, tag, source, runner = run }) {
  parseRelease(tag);
  const directory = realpathSync(target);
  const from = pinnedRelease(await readJson(path.join(directory, 'package.json')));
  if (from && compareReleases(from, tag) > 0)
    return { changed: false, reason: `${entry.name} is already on ${from}, newer than ${tag}.` };
  if (from !== tag) {
    if (entry.kind === 'template') {
      if (!source) throw new Error('A template is regenerated from a checkout of the release.');
      // A release's scripts only run as entry points when invoked by their real path.
      await publishTemplate({
        source: realpathSync(source),
        target: directory,
        entry,
        tag,
        runner,
      });
    } else await updateConsumer({ target: directory, tag, runner });
  }
  const skippedWorkflows = restoreWorkflows(directory, runner);
  if (!runner('git', ['status', '--porcelain'], directory))
    return { changed: false, from, skippedWorkflows };
  await commit(directory, tag, runner);
  return { changed: true, from, skippedWorkflows };
}
