import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { sourceRepository } from '../standard.mjs';

/**
 * The files @williecubed/cli writes into a repository, at the same paths under `repository/` in
 * the package. Every example carries identical copies, and a test fails when one differs.
 */
const COPIES = new URL('../../../repository/', import.meta.url);

/** The release this CLI belongs to, as its tag. */
export const release = `v${JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version}`;

/**
 * Files every repository keeps identical to the standard's and never edits. `cube check owned`
 * fails when one differs, and `cube update` restores it.
 */
export const OWNED_FILES = [
  '.githooks/commit-msg',
  '.githooks/pre-commit',
  '.githooks/pre-push',
  '.githooks/prepare-commit-msg',
  '.codex/hooks.json',
  '.agents/plugins/marketplace.json',
  '.github/actions/setup-node-pnpm/action.yml',
  '.editorconfig',
];

/**
 * Files `cube update` adds when a repository lacks them but never rewrites. A repository's own
 * workflow token may not change workflow files, so rewriting one would block every self-update,
 * and the settings file is the repository's own after it exists.
 */
export const SEEDED_FILES = ['.github/workflows/standard-update.yml', '.claude/settings.json'];

const EXECUTABLES = new Set(OWNED_FILES.filter((name) => name.startsWith('.githooks/')));

// Prettier reads these before prettier.config.js, so any of them silently replaces the org rules.
const SHADOWING_PRETTIER_CONFIGS = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.json5',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  '.prettierrc.ts',
  '.prettierrc.toml',
];

const SETTINGS = '.claude/settings.json';
const MARKETPLACE_REF = new RegExp(
  `("repo"\\s*:\\s*"${sourceRepository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*,\\s*"ref"\\s*:\\s*")([^"]*)(")`,
);

function readOptional(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

const isExecutable = (file) => (statSync(file).mode & 0o111) !== 0;

/** The standard's copy of a file this CLI writes. */
export const standardCopy = (name) => readFileSync(new URL(name, COPIES), 'utf8');

function write(root, name, content) {
  const file = path.join(root, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  if (EXECUTABLES.has(name)) chmodSync(file, 0o755);
}

function ownedFileProblem(root, name) {
  const actual = readOptional(path.join(root, name));
  if (actual === null) return `${name} is missing.`;
  if (actual !== standardCopy(name)) return `${name} differs from the standard's copy.`;
  if (EXECUTABLES.has(name) && !isExecutable(path.join(root, name)))
    return `${name} is not executable.`;
  return undefined;
}

/** What `cube check owned` reports: every way the repository departs from the standard's files. */
export function ownedFileProblems(root) {
  const problems = [];
  for (const name of OWNED_FILES) {
    const problem = ownedFileProblem(root, name);
    if (problem) problems.push(problem);
  }
  if (readOptional(path.join(root, 'prettier.config.js')) !== null) {
    for (const name of SHADOWING_PRETTIER_CONFIGS)
      if (readOptional(path.join(root, name)) !== null)
        problems.push(`${name} replaces the organization's prettier.config.js.`);
  }
  const settings = readOptional(path.join(root, SETTINGS));
  const ref = settings ? MARKETPLACE_REF.exec(settings)?.[2] : undefined;
  if (ref !== undefined && ref !== release)
    problems.push(`${SETTINGS} loads the contribution plugin from ${ref}, not ${release}.`);
  return problems;
}

/** Restores every owned file that is missing, edited, or not executable. */
export function writeOwnedFiles(root, dryRun) {
  const written = OWNED_FILES.filter((name) => ownedFileProblem(root, name) !== undefined);
  if (!dryRun) for (const name of written) write(root, name, standardCopy(name));
  return written;
}

/** Adds each seeded file the repository lacks. */
export function seedFiles(root, dryRun) {
  const added = SEEDED_FILES.filter((name) => readOptional(path.join(root, name)) === null);
  if (!dryRun) for (const name of added) write(root, name, standardCopy(name));
  return added;
}

/**
 * Points the Claude Code contribution plugin at this release. A settings file that loads the
 * plugin from another marketplace keeps its own.
 */
export function syncPluginRef(root, dryRun) {
  const file = path.join(root, SETTINGS);
  const current = readOptional(file);
  if (current === null || !MARKETPLACE_REF.test(current)) return [];
  const next = current.replace(MARKETPLACE_REF, `$1${release}$3`);
  if (next === current) return [];
  if (!dryRun) writeFileSync(file, next);
  return [SETTINGS];
}
