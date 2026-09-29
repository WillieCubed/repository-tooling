# Installation and updates

A repository installs the standard as ordinary dependencies: every `@williecubed/*` package comes
from GitHub Packages at the exact version of one release, and the repository commits none of
repository-tooling's code. The files every repository keeps identical ship inside
`@williecubed/cli`, and `cube update` writes them. The
[GitHub Packages decision](../explanation/decisions/install-from-github-packages.md) records why.

## Registry and versions

| File                    | What it holds                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `.npmrc`                | `@williecubed:registry=https://npm.pkg.github.com`, and no credential                                                       |
| `package.json` (each)   | Every `@williecubed/*` dependency at the release's exact version, such as `"@williecubed/cli": "0.0.2"`                     |
| `pnpm-workspace.yaml`   | `minimumReleaseAgeExclude: ['@williecubed/*']`, so a release installs the day it is published despite `minimumReleaseAge`   |
| `.claude/settings.json` | The `cube` marketplace at the release tag, such as `"ref": "v0.0.2"`, so Claude Code loads the plugin from the same release |

Every package in the workspace pins the same release. `cube check contract` fails on a
`@williecubed/*` dependency written as a range, a `file:` path, or a dist-tag; `workspace:` and
`link:` pass, for repository-tooling itself and for trying an unreleased change.

A repository's own `.npmrc` never carries the token. pnpm 11 ignores a credential that a committed
`.npmrc` reads from an environment variable, and prints a warning on every command, because a
committed file could send the token to another registry.

## Authentication

Installing needs a GitHub token with `read:packages`. The packages are public, so any repository's
workflow token can read them once the workflow grants `packages: read`.

| Where     | Token                                                                         | Configuration                                                                                                                                                |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CI        | The workflow's own token, with `packages: read` in the workflow's permissions | `.github/actions/setup-node-pnpm` passes `registry-url` and `scope` to `actions/setup-node`, which writes a user-level `.npmrc` that reads `NODE_AUTH_TOKEN` |
| A machine | The GitHub CLI's token, refreshed with `read:packages`                        | `~/.npmrc` holds `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`, and the shell profile exports `NODE_AUTH_TOKEN`                                      |

A machine is set up once with these commands, and with `export NODE_AUTH_TOKEN=$(gh auth token)` in
the shell profile:

```sh
gh auth refresh --scopes read:packages
echo '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}' >> ~/.npmrc
```

`cube preflight` asks pnpm for the token it resolves for `npm.pkg.github.com`, never printing it,
and fails `GitHub Packages` when there is none. In CI the check passes, because the setup action
provides the token.

## Files the standard owns

`@williecubed/cli` carries these under `repository/`, at the paths they have in a repository. Every
example carries identical copies, and a test fails when one differs.

| File                                         | Purpose                                                              |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `.githooks/commit-msg`                       | Runs the shared commit-message check from `node_modules`             |
| `.githooks/pre-commit`                       | Runs the shared pre-commit hook                                      |
| `.githooks/pre-push`                         | Runs the shared pre-push hook                                        |
| `.githooks/prepare-commit-msg`               | Runs the shared agent attribution hook                               |
| `.codex/hooks.json`                          | Runs the contribution plugin's guard in Codex                        |
| `.agents/plugins/marketplace.json`           | Loads the contribution plugin in Codex from `node_modules`           |
| `.github/actions/setup-node-pnpm/action.yml` | Installs Node, pnpm, and the lockfile, authenticated to the registry |
| `.editorconfig`                              | Line endings, indentation, and final newlines                        |

`cube check owned` fails when an owned file is missing, differs from the installed CLI's copy, or,
for a hook, is not executable. It also fails when a `.prettierrc` file sits beside
`prettier.config.js`, because Prettier reads it first and drops the shared settings, and when
`.claude/settings.json` loads the contribution plugin from a release other than the installed one. A
change to an owned file belongs in repository-tooling, where it reaches every repository in the next
release.

Two more files are seeded: `cube update` adds `.github/workflows/standard-update.yml` and
`.claude/settings.json` when a repository lacks them and never rewrites them afterwards. A
repository's own workflow token may not change workflow files, and the settings file holds the
repository's own permissions and hooks.

## Update command

`cube update` brings a repository up to the installed release. It works out every change before it
writes any file, so a file it cannot read stops it with nothing changed, and `--dry-run` lists the
changes without writing them. It:

- writes every owned file that is missing, edited, or not executable, and adds each seeded file the
  repository lacks;
- points `.claude/settings.json` at the installed release when it loads the plugin from the `cube`
  marketplace;
- adds the ignore rules the examples carry to the repository's root ignore files where they are
  missing, leaving every existing line, comment, and entry in place: Playwright's output
  (`test-results/`, `playwright-report/`, `blob-report/`, `**/playwright/.cache/`) and agent
  worktrees (`.claude/worktrees/`) in `.gitignore`, agent worktrees in `.prettierignore`, and
  `.claude/worktrees` as the first entry of the `ignores` in `.markdownlint-cli2.jsonc`. A rule
  already written another way that covers the same paths counts as present, and added lines keep the
  file's line endings. A YAML or JavaScript markdownlint configuration is not edited; the command
  prints a warning naming the rule to add;
- gives each Astro project, a package that depends on `astro` and has its own `astro.config.*`, a
  `sync` script (`astro sync`), and adds a `sync` task that `lint` depends on to `turbo.json`, so
  lint reads Astro's generated types on a clean checkout;
- rewrites references to the `@lasvegasfortransit/*` platform packages of the standard this one was
  forked from as `@williecubed/*`, skipping `.claude/worktrees/` and any other nested checkout.

Nothing else in a repository's configuration or product files changes.

## Standard update workflow

Every repository runs `.github/workflows/standard-update.yml` each day, and by hand from the Actions
tab. It installs the repository as CI does, then runs `cube self-update` with only the workflow's
own token:

1. `npm view @williecubed/cli versions` names the newest stable release in GitHub Packages. The
   repository's release is the version its root `package.json` pins `@williecubed/cli` to.
2. A repository already on that release, or a newer one, changes nothing, and an update pull request
   for a release its default branch already has is closed.
3. Otherwise every exact `@williecubed/*` dependency in the workspace moves to the new version,
   `pnpm install` installs it, and that release's own `cube update` runs, so the release's
   migrations apply in the same update however old the repository's release is.
4. A template repository is regenerated instead: the release tag of repository-tooling is cloned,
   and its `standards/template-publication.ts` replaces everything but `.git` and `node_modules`
   with the matching example. The published lockfile is kept and updated with
   `pnpm install --lockfile-only`, so pnpm resolves only what the release changed.
5. The result is committed as `cube-bot` on `automation/repository-standard-<tag>`, pushed, and
   proposed in one pull request through the contribution plugin's helper. The workflow dispatches
   `ci.yml` on the branch so the pull request gets its `Validate` check.

From 0.1.0, a patch release's pull request merges itself once `Validate` passes, and a minor
release's waits for a maintainer. While the standard is on 0.0.x, any release can change how a
repository works, so every update pull request waits for a maintainer. A newer release closes the
older pull requests it replaces, and an update branch that fell behind `main` is rebuilt unless
someone pushed a fix to it. The workflow's token may not change workflow files, so a release that
changes one opens its pull request without that file, and the run fails and names the file to copy
by hand. `cube self-update --dry-run` commits the update on its branch and stops before anything
reaches GitHub.

## Unreleased changes

A branch that tries an unreleased change points the `@williecubed/*` dependencies at a local
checkout of repository-tooling with `link:`, such as
`"@williecubed/cli": "link:../repository-tooling/packages/cli"`, and is never merged.
`cube check contract` accepts `link:`, and `Standard status` flags a `main` that pins no release.
