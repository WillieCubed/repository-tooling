import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { standard } from '../standard.mjs';
import { AGENT_WORKTREES } from './consumer-ignores.mjs';

/**
 * The package scope of the standard this one was forked from. A repository that started from it
 * moves to this owner's packages; docs/reference/installation.md describes the migration.
 */
export const LEGACY_SCOPE = '@lasvegasfortransit';
const LEGACY_PLATFORM_PACKAGES = [
  'cli',
  'eslint-config',
  'playwright-config',
  'prettier-config',
  'typescript-config',
  'vitest-config',
  'web-platform',
];

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  '.turbo',
  'test-results',
  'playwright-report',
  'blob-report',
]);

async function repositoryFiles(root, relative = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isFile()) files.push(name);
    if (!entry.isDirectory() || SKIPPED_DIRECTORIES.has(entry.name)) continue;
    // A nested checkout, such as an agent worktree under .claude/worktrees/, is another branch's,
    // and so is a worktree folder whose .git is already gone.
    const nested =
      name === path.join(...AGENT_WORKTREES.split('/')) ||
      existsSync(path.join(root, name, '.git'));
    if (!nested) files.push(...(await repositoryFiles(root, name)));
  }
  return files;
}

/** Rewrites every reference to a legacy platform package to this owner's package. */
export async function migrateLegacyPackageScope(root, dryRun) {
  const changed = [];
  for (const relative of await repositoryFiles(root)) {
    const file = path.join(root, relative);
    const source = await readFile(file, 'utf8').catch(() => null);
    if (source === null || source.includes('\0')) continue;
    let next = source;
    for (const name of LEGACY_PLATFORM_PACKAGES)
      next = next.replaceAll(`${LEGACY_SCOPE}/${name}`, `${standard.npmScope}/${name}`);
    if (next === source) continue;
    changed.push(relative.split(path.sep).join('/'));
    if (!dryRun) await writeFile(file, next);
  }
  return changed.sort();
}
