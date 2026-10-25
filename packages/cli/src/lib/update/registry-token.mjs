import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { formatJson } from './astro-sync.mjs';

// pnpm reads the GitHub Packages token from NODE_AUTH_TOKEN, through ~/.npmrc locally and the
// .npmrc setup-node writes in CI. Turbo runs tasks without variables it isn't told about, so pnpm
// inside every task warned that it could not read the token. Passing it through keeps it out of
// task hashes while letting pnpm resolve its configuration.
const TOKEN = 'NODE_AUTH_TOKEN';

/** A copy of `turbo` that passes the token through, placed after `globalEnv` where there is one. */
function withPassThrough(turbo) {
  const current = turbo.globalPassThroughEnv ?? [];
  if (current.includes(TOKEN)) return turbo;
  const value = [...current, TOKEN];
  if ('globalPassThroughEnv' in turbo) return { ...turbo, globalPassThroughEnv: value };
  const entries = Object.entries(turbo);
  const after = entries.findIndex(([key]) => key === 'globalEnv');
  const at = after === -1 ? entries.findIndex(([key]) => key === 'tasks') : after + 1;
  entries.splice(at === -1 ? entries.length : at, 0, ['globalPassThroughEnv', value]);
  return Object.fromEntries(entries);
}

/** Lets pnpm inside every Turbo task read the registry token; returns turbo.json when it changes. */
export async function passRegistryTokenThroughTurbo(root, dryRun) {
  const file = path.join(root, 'turbo.json');
  let turbo;
  try {
    turbo = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // A repository without a readable turbo.json has no tasks to pass the token to.
    return [];
  }
  const next = withPassThrough(turbo);
  if (next === turbo) return [];
  if (!dryRun) await writeFile(file, `${formatJson(next)}\n`);
  return ['turbo.json'];
}
