import { sourceRepository, standard } from '../standard.mjs';

/** Update branches are named after the release they install. */
export const BRANCH_PREFIX = 'automation/repository-standard-';
const STABLE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/**
 * @param {string} tag
 * @returns {[number, number, number]}
 */
export function parseRelease(tag) {
  const match = STABLE_TAG.exec(tag);
  if (!match) throw new Error(`A standard update needs a stable release tag, not ${tag}.`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareReleases(left, right) {
  const a = parseRelease(left);
  const b = parseRelease(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = a[index] - b[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * The newest stable tag, ignoring prereleases and anything else.
 *
 * @param {string[]} tags
 * @returns {string | undefined}
 */
export function latestRelease(tags) {
  return tags
    .filter((tag) => STABLE_TAG.test(tag))
    .sort(compareReleases)
    .at(-1);
}

/**
 * Whether moving from one release to another is a patch: fixes only, so its update merges itself.
 * A minor or major step can change behavior, so a maintainer merges it after reading the notes.
 *
 * @param {string | null | undefined} from
 * @param {string} to
 * @returns {boolean}
 */
export function isPatchUpdate(from, to) {
  if (!from || !STABLE_TAG.test(from)) return false;
  const [fromMajor, fromMinor] = parseRelease(from);
  const [toMajor, toMinor] = parseRelease(to);
  return fromMajor === toMajor && fromMinor === toMinor && compareReleases(to, from) > 0;
}

/**
 * The release a repository is on: the exact version its root package.json pins the CLI to, as a
 * tag, or null when it pins none.
 *
 * @param {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} manifest
 * @returns {string | null}
 */
export function pinnedRelease(manifest) {
  const name = `${standard.npmScope}/cli`;
  const range = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
  return range !== undefined && /^\d+\.\d+\.\d+$/.test(range) ? `v${range}` : null;
}

/** @param {string} tag */
export function updateBranch(tag) {
  parseRelease(tag);
  return `${BRANCH_PREFIX}${tag}`;
}

/**
 * Decides what to do with the update pull requests already open in a repository. Older releases
 * are closed as superseded; a newer one means this release must not be proposed at all.
 *
 * @param {{ number: number, headRefName: string }[]} open
 * @param {string} tag
 */
export function planOpenUpdates(open, tag) {
  const current = updateBranch(tag);
  const superseded = [];
  const newer = [];
  for (const update of open) {
    if (!update.headRefName.startsWith(BRANCH_PREFIX) || update.headRefName === current) continue;
    const release = update.headRefName.slice(BRANCH_PREFIX.length);
    if (!STABLE_TAG.test(release)) continue;
    if (compareReleases(release, tag) < 0) superseded.push(update);
    else newer.push(update);
  }
  return { superseded, newer };
}

/** @param {string} tag */
export function releaseNotesPath(tag) {
  return `docs/reference/release-${tag.slice(1).replaceAll('.', '-')}.md`;
}

/** @param {string} tag */
export function pullRequestTitle(tag) {
  return `chore: update ${standard.owner} repository standard to ${tag}`;
}

/**
 * @param {{ tag: string, kind: 'template' | 'consumer', automerge: boolean }} options
 * @returns {string}
 */
export function pullRequestBody({ tag, kind, automerge }) {
  const source = `https://github.com/${sourceRepository}`;
  const notes = `The [release notes](${source}/blob/${tag}/${releaseNotesPath(tag)}) say what changes for a repository that updates.`;
  const change =
    kind === 'template'
      ? `The files are generated from the reviewed ${tag} example in repository-tooling.`
      : `Every \`${standard.npmScope}/*\` dependency moves to ${tag.slice(1)}, and that release's \`${standard.cliName} update\` brings the files the standard owns up to date.`;
  const merge = automerge
    ? 'It is a patch release, so it merges itself once `Validate` passes.'
    : 'It is a minor release, which can change how the repository works, so a maintainer merges it after reading the release notes.';
  return [
    '## TL;DR',
    '',
    `Moves this repository to ${standard.owner} repository standard ${tag}.`,
    '',
    '## Changes',
    '',
    `${change} ${notes}`,
    '',
    `This pull request was opened by this repository's \`Standard update\` workflow. ${merge} If \`Validate\` fails, fix the repository on this branch; a newer release closes this pull request and opens its own.`,
    '',
    '## Follow-ups and Next Work',
    '',
    'None.',
    '',
  ].join('\n');
}

/** @param {string} tag */
export function commitMessage(tag) {
  return `${pullRequestTitle(tag)}\n\nApply the reviewed ${tag} release with its own updater.\n`;
}
