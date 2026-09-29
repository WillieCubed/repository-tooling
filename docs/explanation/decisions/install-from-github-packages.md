# Install the standard from GitHub Packages

Decided 2026-09-28.

## Decision

A repository installs `@williecubed/*` from GitHub Packages at exact versions, like any other
dependency. It does not carry a copy of repository-tooling. The files every repository keeps
identical (the git hooks, the setup action, `.editorconfig`, and the agent hook files) ship inside
`@williecubed/cli`, and `cube check` compares a repository's copies with the ones in the installed
version. `cube update` writes them.

## Why

A repository commits only what it owns. The vendored snapshot put about 225 files of
repository-tooling into every repository, including templates for other kinds of app, the
publication and propagation scripts, and the production reconciler, most of which the repository
never ran. A version number in `package.json` and an integrity hash in the lockfile pin the same
code without copying it.

## Rejected

- **A vendored snapshot under `.williecubed/web-platform/`**, the model this fork inherited. It
  avoided a registry login, at the cost of every repository committing code it does not own.
- **Public npm.** Installing needs no token, but publishing needs a second account and a publish
  token outside GitHub, while GitHub Packages keeps each release beside its source and its workflow.
- **Git dependencies on a release tag.** No registry is involved, but repository-tooling would have
  to be public, and installs are slower than from a registry.

## Consequences

- Installing needs a token with `read:packages`. CI uses the workflow's own token, so every workflow
  that installs declares `packages: read`. The packages are public, so no repository needs access
  granted package by package. On a machine, `NODE_AUTH_TOKEN` carries the token; `gh auth token`
  provides one after `gh auth refresh --scopes read:packages`. `cube preflight` checks for it.
- `minimumReleaseAge` exempts `@williecubed/*`, so a release installs the day it is published.
- `.williecubed/web-platform/`, `.williecubed/web-platform.json`, and the `standards:check` and
  `standards:update` scripts no longer exist in consumers. A standard update bumps the
  `@williecubed/*` versions, runs `cube update`, and opens one pull request.
