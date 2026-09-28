import { sourceRepository, standard } from '../standard.mjs';
import { ownedFileProblems } from '../update/standard-files.mjs';

/**
 * The files every repository keeps identical to the standard's (the git hook stubs, the setup
 * action, `.editorconfig`, and the agent hook files) match the copies in the installed
 * `@williecubed/cli`, no `.prettierrc` replaces the shared Prettier settings, and the contribution
 * plugin loads from the installed release.
 */
export function checkOwned({ cwd }) {
  const lines = ownedFileProblems(cwd);
  return {
    name: 'owned',
    ok: lines.length === 0,
    lines,
    fix: `run \`pnpm exec ${standard.cliName} update\` to restore the standard's files, delete any .prettierrc file, and make a shared change in ${sourceRepository} instead`,
  };
}
