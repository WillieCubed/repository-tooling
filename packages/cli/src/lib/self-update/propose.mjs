import path from 'node:path';

import { standard } from '../standard.mjs';
import { run, withTemporaryFile } from './apply.mjs';
import {
  isPatchUpdate,
  pinnedRelease,
  planOpenUpdates,
  pullRequestBody,
  pullRequestTitle,
  updateBranch,
} from './release.mjs';

/**
 * Compares the freshly generated update commit with the branch already on GitHub. A branch that
 * carries someone's fix is kept; a bot-only branch is replaced when the base or the result moved.
 */
function remoteBranchState(target, branch, runner) {
  if (!runner('git', ['ls-remote', '--heads', 'origin', branch], target)) {
    // A tracking ref left from a branch GitHub has since deleted would make --force-with-lease
    // refuse the push, so forget it.
    runner('git', ['update-ref', '-d', `refs/remotes/origin/${branch}`], target);
    return 'absent';
  }
  runner(
    'git',
    ['fetch', '--quiet', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`],
    target,
  );
  const authors = runner('git', ['log', '--format=%ae', `HEAD^..origin/${branch}`], target).split(
    '\n',
  );
  if (authors.some((author) => author !== standard.bot.email)) return 'edited';
  const same = (ref) =>
    runner('git', ['rev-parse', `origin/${branch}${ref}`], target) ===
    runner('git', ['rev-parse', `HEAD${ref}`], target);
  return same('^') && same('^{tree}') ? 'current' : 'stale';
}

function openUpdates(target, runner) {
  return JSON.parse(
    runner(
      'gh',
      [
        'pr',
        'list',
        '--state',
        'open',
        '--base',
        'main',
        '--json',
        'number,headRefName',
        '--limit',
        '100',
      ],
      target,
    ),
  );
}

/**
 * Pushes a new or rebuilt update branch, or adopts the one on GitHub when it is current or fixed.
 * Returns true when it pushed.
 */
function pushUpdateBranch(target, name, branch, runner) {
  const state = remoteBranchState(target, branch, runner);
  if (state === 'absent' || state === 'stale') {
    runner('git', ['push', '--force-with-lease', '--set-upstream', 'origin', branch], target);
    return true;
  }
  if (state === 'edited') {
    process.stdout.write(`${name}: keeping the fixes already pushed to ${branch}.\n`);
    runner('git', ['reset', '--quiet', '--hard', `origin/${branch}`], target);
  }
  runner('git', ['branch', '--set-upstream-to', `origin/${branch}`], target);
  return false;
}

/**
 * Opens the update pull request with the contribution plugin's helper, or refreshes the one already
 * open. The helper comes from the repository's installed CLI, which after a consumer's update is
 * the release being proposed.
 */
function createOrEdit({ target, tag, title, body, runner }) {
  const existing = JSON.parse(
    runner(
      'gh',
      ['pr', 'list', '--head', updateBranch(tag), '--state', 'open', '--json', 'number'],
      target,
    ),
  );
  if (existing[0]) {
    runner(
      'gh',
      ['pr', 'edit', String(existing[0].number), '--title', title, '--body-file', body],
      target,
    );
    return existing[0].number;
  }
  const helper = path.join(
    target,
    'node_modules',
    standard.npmScope,
    'cli/plugins',
    standard.pluginName,
    'scripts/github-create.mjs',
  );
  const args = [helper, 'pr', '--title', title, '--body-file', body, '--base', 'main', '--json'];
  runner('node', [...args, '--dry-run'], target);
  return JSON.parse(runner('node', args, target)).number;
}

/** The release the repository's default branch is on, read from GitHub rather than the checkout. */
function defaultBranchRelease(target, runner) {
  const manifest = runner(
    'gh',
    [
      'api',
      'repos/{owner}/{repo}/contents/package.json',
      '-H',
      'Accept: application/vnd.github.raw',
    ],
    target,
  );
  return pinnedRelease(JSON.parse(manifest));
}

/** Runs Validate on the update branch; a workflow token's push alone starts no workflow. */
function dispatchValidation(target, branch, runner) {
  try {
    runner('gh', ['workflow', 'run', 'ci.yml', '--ref', branch], target);
  } catch {
    process.stderr.write(
      `Could not run ci.yml on ${branch}. Give ci.yml a workflow_dispatch trigger, as the examples' has, so update pull requests get their Validate check.\n`,
    );
    process.exitCode = 1;
  }
}

/**
 * Pushes the update branch, opens or refreshes its pull request, enables auto-merge for a patch,
 * and closes update pull requests for older releases.
 */
export async function proposeRelease({ target, entry, tag, changed, from, runner = run }) {
  const automerge = isPatchUpdate(from, tag);
  const open = openUpdates(target, runner);
  const { superseded, newer } = planOpenUpdates(open, tag);
  if (newer.length > 0) {
    process.stdout.write(`${entry.name}: a newer update is already open (#${newer[0].number}).\n`);
    return undefined;
  }

  let number;
  if (changed) {
    const branch = updateBranch(tag);
    const pushed = pushUpdateBranch(target, entry.name, branch, runner);
    const title = pullRequestTitle(tag);
    const content = pullRequestBody({ tag, kind: entry.kind, automerge });
    number = await withTemporaryFile(content, (body) =>
      createOrEdit({ target, tag, title, body, runner }),
    );
    if (automerge) runner('gh', ['pr', 'merge', String(number), '--auto', '--rebase'], target);
    // A push made with a repository's own GITHUB_TOKEN starts no workflow, but a dispatch always
    // does, and its Validate check lands on the branch's head commit.
    if (pushed) dispatchValidation(target, branch, runner);
  } else if (defaultBranchRelease(target, runner) === tag) {
    // Only a default branch that already carries the release makes its update pull request moot;
    // a checkout that happens to be on the update branch does not.
    superseded.push(...open.filter(({ headRefName }) => headRefName === updateBranch(tag)));
  }

  for (const update of superseded) {
    const comment = number
      ? `Superseded by #${number}, which updates to ${tag}.`
      : `Superseded: this repository already matches ${tag}.`;
    runner(
      'gh',
      ['pr', 'close', String(update.number), '--comment', comment, '--delete-branch'],
      target,
    );
  }
  return number ? `${entry.name}: #${number}` : `${entry.name}: already on ${tag}`;
}
