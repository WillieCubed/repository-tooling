import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isAstroProject, packageDirectories } from '../check/contract.mjs';

// An Astro package generates its astro:content and environment types with `astro sync`. On a
// clean checkout, as in CI, type-aware lint rules fail on every module that imports them until it
// has run. Every Astro package gets a `sync` script, and turbo.json runs it before lint and caches
// what it writes. `cube check contract` requires the same wiring.
const SYNC_SCRIPT = 'astro sync';
const SYNC_TASK = { outputs: ['.astro/**'] };
const PRINT_WIDTH = 100;

/** A copy of `object` with `key` placed before or after another key, or last when it is absent. */
function withEntry(object, key, value, at) {
  const entries = Object.entries(object);
  const anchor = entries.findIndex(([name]) => name === (at.before ?? at.after));
  if (anchor === -1) return { ...object, [key]: value };
  entries.splice(at.before ? anchor : anchor + 1, 0, [key, value]);
  return Object.fromEntries(entries);
}

function formatArray(value, indent, lead) {
  if (value.length === 0) return '[]';
  const plain = value.every((item) => item === null || typeof item !== 'object');
  const inline = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
  if (plain && lead + inline.length + 1 <= PRINT_WIDTH) return inline;
  const inner = `${indent}  `;
  const items = value.map((item) => `${inner}${formatJson(item, inner, inner.length)}`);
  return `[\n${items.join(',\n')}\n${indent}]`;
}

function formatObject(value, indent) {
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  const inner = `${indent}  `;
  const lines = entries.map(([key, item]) => {
    const label = `${JSON.stringify(key)}: `;
    return `${inner}${label}${formatJson(item, inner, inner.length + label.length)}`;
  });
  return `{\n${lines.join(',\n')}\n${indent}}`;
}

/**
 * JSON as Prettier prints a .json file: objects expanded one key per line, and arrays of plain
 * values on one line when the whole line fits the organization's print width.
 */
export function formatJson(value, indent = '', lead = 0) {
  if (Array.isArray(value)) return formatArray(value, indent, lead);
  if (value !== null && typeof value === 'object') return formatObject(value, indent);
  return JSON.stringify(value);
}

/** Gives each Astro package a `sync` script; reports whether any exist and which files change. */
async function addSyncScripts(root, dryRun) {
  const changed = [];
  let astro = false;
  if (!existsSync(path.join(root, 'pnpm-workspace.yaml'))) return { astro, changed };
  for (const directory of packageDirectories(root)) {
    const file = path.join(root, directory, 'package.json');
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    if (!isAstroProject(root, directory, manifest)) continue;
    astro = true;
    if (manifest.scripts?.sync) continue;
    manifest.scripts = withEntry(manifest.scripts ?? {}, 'sync', SYNC_SCRIPT, { after: 'lint' });
    changed.push(`${directory}/package.json`);
    // Prettier prints package.json exactly as JSON.stringify does.
    if (!dryRun) await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return { astro, changed };
}

/** The turbo.json tasks with a `sync` task that `lint` depends on. */
function wiredTasks(tasks) {
  const withSync = tasks.sync ? tasks : withEntry(tasks, 'sync', SYNC_TASK, { before: 'lint' });
  const lint = withSync.lint ?? { dependsOn: ['^lint'] };
  const dependsOn = lint.dependsOn ?? [];
  if (dependsOn.includes('sync')) return withSync;
  return { ...withSync, lint: { ...lint, dependsOn: [...dependsOn, 'sync'] } };
}

/** Runs `sync` before `lint` in the root turbo.json; returns the file when it changes. */
async function wireTurbo(root, dryRun) {
  const file = path.join(root, 'turbo.json');
  let turbo;
  try {
    turbo = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // A missing or commented turbo.json is left alone; `cube check contract` names what to add.
    return [];
  }
  if (!turbo.tasks) return [];
  const tasks = wiredTasks(turbo.tasks);
  if (tasks === turbo.tasks) return [];
  if (!dryRun) await writeFile(file, `${formatJson({ ...turbo, tasks })}\n`);
  return ['turbo.json'];
}

/** Adds the `sync` script to each Astro package and runs it before lint in turbo.json. */
export async function syncAstroTypesBeforeLint(root, dryRun) {
  const { astro, changed } = await addSyncScripts(root, dryRun);
  if (!astro) return changed;
  return [...changed, ...(await wireTurbo(root, dryRun))];
}
