# Working in repository-tooling

Run `pnpm check` after every change. Keep the human-facing templates free of hidden markers and
agent instructions. `CLAUDE.md` is a symlink to this file; edit this one.

This repository is a pnpm workspace that follows Turborepo conventions. `packages/` holds the shared
packages every personal repository installs: `eslint-config`, `typescript-config`,
`prettier-config`, `vitest-config`, `playwright-config`, `web-platform`, the security packages
(`access`, `edge-security`, `audit`, `data`), and `cli` (the `willie` command, the git hooks under
`hooks/`, the contribution plugin under `plugins/`, and the version catalog in `catalog.json`).
`examples/` holds the repositories the templates are published from; each is a complete, runnable
Turborepo workspace, and a test proves it passes its own checks. The catalog in every
`pnpm-workspace.yaml` here must match `packages/cli/catalog.json`; a test fails when they differ.

Every value that names an owner, such as the GitHub owner, npm scope, command name, vendor
directory, Cloudflare account, or Access team, comes from `standard.config.ts`. Never write one out
in code, templates, or documentation examples that code generates.

Documentation comes first. A change to a rule updates its document under `docs/` in the same change,
and a new rule gets a document before it gets code. Decisions that were expensive to make go in
`docs/explanation/decisions/`, each naming what was rejected and when to revisit.

A change to anything a consumer installs (`packages/*`) or copies (`examples/*`) is a release: bump
the version in every package manifest and the root `package.json` together, update the tag the
examples pin, and describe what changes for consumers in `docs/reference/release-X-Y-Z.md`. Never
edit a file in a consumer repository to change a shared rule; change the package here so every
repository gets it.

Changes to the contribution workflow must update its tests, both plugin manifests, and the published
community-health files in `WillieCubed/.github` in the same rollout.

Use the `github-contribution` skill and its helper for issue or pull request creation. Do not call
`gh issue create`, `gh pr create`, or equivalent API or connector methods directly.

Commit scopes are optional. The repository's `.williecubed/commit-scopes.txt` file is the complete
list of durable boundaries for this repository. Do not invent a scope for a feature, file, or task;
omit it when the change crosses boundaries. Stage and commit in one command that first resets the
index: `git restore --staged . && git add <paths> && git commit -F <file>`.

Nothing is published or tagged from this repository without the maintainer's explicit approval.
`Publish packages` runs only by hand. Every repository's daily `Standard update` workflow picks up a
new release tag and opens an update pull request in that repository, using only that workflow's own
token. A patch release's pull request merges itself; a minor release's waits for a maintainer. A new
rule warns for at least one minor release before it fails.
