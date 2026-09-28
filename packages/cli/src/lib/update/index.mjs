import { CliError } from '../arguments.mjs';
import { syncAstroTypesBeforeLint } from './astro-sync.mjs';
import { consumerIgnoreWarnings, syncConsumerIgnores } from './consumer-ignores.mjs';
import { migrateLegacyPackageScope } from './legacy-scope.mjs';
import { release, seedFiles, syncPluginRef, writeOwnedFiles } from './standard-files.mjs';

const unique = (names) => [...new Set(names)].sort();

async function plan(root, dryRun) {
  return {
    written: unique([...writeOwnedFiles(root, dryRun), ...seedFiles(root, dryRun)]),
    migrated: unique([
      ...(await migrateLegacyPackageScope(root, dryRun)),
      ...(await syncConsumerIgnores(root, dryRun)),
      ...(await syncAstroTypesBeforeLint(root, dryRun)),
      ...syncPluginRef(root, dryRun),
    ]),
  };
}

/**
 * Brings a repository up to this release of the standard: writes the files the standard owns,
 * adds the seeded files it lacks, and migrates the repository's own files that a release changes,
 * such as its ignore rules. `written` names the standard's files; `migrated` names the
 * repository's own.
 */
export async function applyUpdate(root, { dryRun = false } = {}) {
  // Planning first means a repository file a migration can't read stops the update before any write.
  const planned = await plan(root, true);
  const warnings = await consumerIgnoreWarnings(root);
  if (!dryRun) await plan(root, false);
  return { ...planned, warnings };
}

/** `cube update [--dry-run]`. */
export async function update({ cwd, options }) {
  let result;
  try {
    result = await applyUpdate(cwd, { dryRun: options.dryRun });
  } catch (error) {
    throw new CliError(`update: ${error.message} Nothing was changed.`, 1);
  }
  const { written, migrated, warnings } = result;
  for (const warning of warnings) process.stderr.write(`warning: ${warning}\n`);
  const [write, migrate] = options.dryRun ? ['write', 'migrate'] : ['wrote', 'migrated'];
  for (const name of written) process.stdout.write(`  ${write.padEnd(9)} ${name}\n`);
  for (const name of migrated) process.stdout.write(`  ${migrate.padEnd(9)} ${name}\n`);
  const count = written.length + migrated.length;
  if (count === 0) process.stdout.write(`update: already on the ${release} standard\n`);
  else if (options.dryRun)
    process.stdout.write(`update: ${count} files would change (dry run; nothing was written)\n`);
  else process.stdout.write(`update: ${count} files changed for the ${release} standard\n`);
}
