import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { CliError } from '../arguments.mjs';
import { sourceRepository, standard } from '../standard.mjs';
import { applyRelease, run } from './apply.mjs';
import { proposeRelease } from './propose.mjs';
import { latestRelease, updateBranch } from './release.mjs';

/** A template repository is regenerated from its example; every other repository is updated. */
export function repositoryEntry(name, isTemplate) {
  return isTemplate
    ? { name, kind: 'template', example: name.replace(/^template-/, '') }
    : { name, kind: 'consumer' };
}

/** The newest stable release of the standard published to GitHub Packages, as a tag. */
export function publishedRelease(cwd, runner = run) {
  const output = runner('npm', ['view', `${standard.npmScope}/cli`, 'versions', '--json'], cwd);
  const versions = [JSON.parse(output)].flat();
  const latest = latestRelease(versions.map((version) => `v${version}`));
  if (!latest) throw new CliError(`${standard.npmScope}/cli has no stable release to install.`);
  return latest;
}

/** A template is regenerated from the release's own checkout of repository-tooling. */
async function withReleaseSource(entry, tag, runner, use) {
  if (entry.kind !== 'template') return use(undefined);
  const source = await mkdtemp(path.join(os.tmpdir(), `${standard.cliName}-release-`));
  try {
    const upstream = `https://github.com/${sourceRepository}.git`;
    runner(
      'git',
      ['clone', '--quiet', '--depth', '1', '--branch', tag, '--single-branch', upstream, source],
      source,
    );
    return await use(source);
  } finally {
    await rm(source, { recursive: true, force: true });
  }
}

/**
 * `cube self-update [--dry-run]`: runs in a repository's own `Standard update` workflow with that
 * repository's GITHUB_TOKEN. Moves the repository to the newest published release through one pull
 * request, and closes update pull requests it no longer needs. `--dry-run` commits the update on
 * its branch and stops before anything reaches GitHub.
 */
export async function selfUpdate({ cwd, options, runner = run, env = process.env }) {
  const repository = env.GITHUB_REPOSITORY ?? `${standard.owner}/${path.basename(cwd)}`;
  const name = repository.split('/')[1] ?? path.basename(cwd);
  const isTemplate =
    runner('gh', ['api', `repos/${repository}`, '--jq', '.is_template'], cwd) === 'true';
  const entry = repositoryEntry(name, isTemplate);
  const tag = publishedRelease(cwd, runner);

  const result = await withReleaseSource(entry, tag, runner, (source) =>
    applyRelease({ target: cwd, entry, tag, source, runner }),
  );
  if (result.reason) {
    process.stdout.write(`${result.reason}\n`);
    return;
  }
  if (options.dryRun) {
    process.stdout.write(
      result.changed
        ? `${name}: committed ${tag} on ${updateBranch(tag)}; not pushed (dry run).\n`
        : `${name}: already matches ${tag}.\n`,
    );
  } else {
    const outcome = await proposeRelease({ target: cwd, entry, tag, ...result, runner });
    if (outcome) process.stdout.write(`${outcome}\n`);
  }
  if (result.skippedWorkflows.length > 0)
    throw new CliError(
      `${tag} changes workflow files this workflow's token may not push. Copy them from the ${tag} example by hand:\n${result.skippedWorkflows.join('\n')}`,
      1,
    );
}
