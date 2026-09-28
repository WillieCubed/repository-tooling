# Why packages and examples

Every personal repository should have the same structure and the same behavior: the same commands,
the same lint rules, the same TypeScript strictness, the same hooks, the same CI job. This page
explains how that is achieved with nothing that a developer who has never seen this standard would
find unusual.

## Turborepo's conventions, not ours

Turborepo already defines how a JavaScript monorepo shares configuration: `packages/eslint-config`
exporting a `config` per environment, `packages/typescript-config` with JSON files to extend,
`packages/vitest-config` exporting a shared object, `turbo.json` naming the tasks, and
`create-turbo --example` copying a runnable example to start a new repository. This repository does
exactly that under the `@williecubed` scope. A new contributor can read Turborepo's documentation
and understand every file.

## Rules travel as packages

Anything that must be identical everywhere lives in a package: the ESLint and TypeScript rules, the
Prettier settings, the Vitest defaults, the git hooks, the agent plugin, and the operational
commands `bootstrap`, `preflight`, and `deploy`. A repository extends them in one-line configs and
installs them from GitHub Packages at one exact release, like any other dependency. A change to a
rule is a new release, reviewed once here and then reviewed in each repository as a version bump.

## Structure travels as examples

What cannot be a package is a file that must sit in the repository itself: the hook stubs git needs
on disk, the harness files Claude Code and Codex read, the CI workflows, and the one-line configs.
Those come from the example a template copies. The ones every repository keeps identical, such as
the hook stubs and the setup action, also ship inside `@williecubed/cli`, so `cube check owned`
compares a repository's copies with the installed release and `cube update` restores them. Every
other file is the repository's own. When a release changes what one of those must contain, such as a
new generated folder that git must ignore, `cube update` adds exactly that and reports the file, so
every repository gets the fix from one reviewed update.

## What was rejected, and why

An earlier design vendored only the contribution plugin and recorded per-file digests in a pin file.
That did not version the package rules, catalog, updater, and templates as one unit. The design
after it vendored a hash-checked copy of all of repository-tooling into every repository, which
versioned everything as one unit but made each repository commit code it did not own. The
[GitHub Packages decision](decisions/install-from-github-packages.md) replaced it with ordinary
versioned dependencies.

## What this costs

The standard must keep the packages small and stable, because every repository feels a change to
them. A repository that needs to diverge does so in its own file, on top of the shared rule, and
says why in the commit. A release still needs a tag, release notes, and a publish to GitHub
Packages, and installing needs a token with `read:packages`. Each repository's daily
`Standard update` workflow then opens the update in that repository. A patch update merges once the
repository's own checks pass; a minor update waits for a maintainer.
