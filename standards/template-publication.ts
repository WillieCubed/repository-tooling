import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { cp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { marketplace, standard } from '../standard.config.ts';

const examples = new Set(['basic', 'with-astro', 'with-vite-react']);
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;
// Kept when the target is cleared: its history, and the dependencies its own workflow installed.
const kept = new Set(['.git', 'node_modules']);

type Manifest = Partial<Record<(typeof dependencyFields)[number], Record<string, string>>>;
interface Settings {
  extraKnownMarketplaces?: Record<string, { source?: { ref?: string } }>;
}

async function manifestPaths(root: string): Promise<string[]> {
  const manifests = [path.join(root, 'package.json')];
  for (const parent of ['apps', 'packages']) {
    const directory = path.join(root, parent);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) manifests.push(path.join(directory, entry.name, 'package.json'));
    }
  }
  return manifests;
}

/**
 * Every place an example names the release it belongs to that disagrees with `release`: a
 * `@williecubed/*` dependency, or the ref the contribution plugin loads from.
 */
async function releaseMismatches(example: string, release: string): Promise<string[]> {
  const version = release.slice(1);
  const found: string[] = [];
  for (const file of await manifestPaths(example)) {
    const manifest = JSON.parse(await readFile(file, 'utf8')) as Manifest;
    for (const field of dependencyFields) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        if (name.startsWith(`${standard.npmScope}/`) && range !== version)
          found.push(`${path.relative(example, file)} pins ${name} to ${range}`);
      }
    }
  }
  const settings = JSON.parse(
    await readFile(path.join(example, '.claude/settings.json'), 'utf8'),
  ) as Settings;
  const ref = settings.extraKnownMarketplaces?.[marketplace]?.source?.ref;
  if (ref !== release) found.push(`.claude/settings.json loads the plugin from ${String(ref)}`);
  return found;
}

/**
 * Makes `target` an exact copy of one example at a release. The example already pins every
 * `@williecubed/*` package to the release, so the copy installs from GitHub Packages like any
 * repository; publication refuses an example that names a different release.
 */
export async function materializeTemplate(options: {
  source: string;
  target: string;
  example: string;
  release: string;
}): Promise<void> {
  const source = path.resolve(options.source);
  const target = path.resolve(options.target);
  if (!examples.has(options.example))
    throw new Error(`Unknown template example: ${options.example}`);
  if (source === target) throw new Error('Source and target directories must differ.');
  if (!/^v\d+\.\d+\.\d+$/.test(options.release))
    throw new Error('Use an explicit version tag, such as v0.0.1.');

  const git = (args: string[]) =>
    execFileSync('git', ['-C', source, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  let tagged: string;
  try {
    tagged = git(['rev-parse', '--verify', `refs/tags/${options.release}^{commit}`]);
  } catch {
    throw new Error(`The source checkout has no tag ${options.release}.`);
  }
  if (git(['rev-parse', 'HEAD']) !== tagged || git(['status', '--porcelain'])) {
    throw new Error('Template publication requires a clean checkout of the requested release.');
  }
  const example = path.join(source, 'examples', options.example);
  const mismatches = await releaseMismatches(example, options.release);
  if (mismatches.length > 0)
    throw new Error(
      `examples/${options.example} does not belong to ${options.release}: ${mismatches.join('; ')}.`,
    );

  const entries = await readdir(target, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => !kept.has(entry.name))
      .map((entry) => rm(path.join(target, entry.name), { recursive: true, force: true })),
  );
  await cp(example, target, { recursive: true });
}

export async function main(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      source: { type: 'string' },
      target: { type: 'string' },
      example: { type: 'string' },
      release: { type: 'string' },
    },
  });
  if (!values.source || !values.target || !values.example || !values.release) {
    throw new Error(
      'Usage: --source <repository> --target <directory> --example <name> --release <tag>',
    );
  }
  await materializeTemplate({
    source: values.source,
    target: values.target,
    example: values.example,
    release: values.release,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
