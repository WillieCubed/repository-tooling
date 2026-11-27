# Publish a tooling release

This guide cuts a release of the standard so repositories can move to it. A release tag identifies
the source, and the shared packages publish to GitHub Packages under the `@williecubed` scope at the
same version. Repositories install those packages at that exact version, and published templates
copy the examples at that tag.

## Before you start

- The change is merged to `main` and CI is green.
- The standard passes its consumer validation in every repository that it affects.
- The version still names the latest published release. Development commits do not advance it and do
  not receive sequential prerelease tags.

## 1. Set one version everywhere

Choose the new version from the published contract. While the standard is on 0.0.x, which lasts
until its first release a maintainer calls useful, every release increments the patch number and may
change how a repository works. From 0.1.0, a backward-compatible fix increments the patch number, a
new backward-compatible consumer capability increments the minor number, and a breaking change
before 1.0 increments the minor number and includes an explicit migration path.

In the release commit, set the root `package.json`, every `packages/*/package.json`, both plugin
manifests under `packages/cli/plugins/willie-contributions/`, and `.claude-plugin/marketplace.json`
to the same version. Pin the examples' `@williecubed/*` dependencies to the version, and point the
Claude marketplace ref in each example and in `packages/cli/repository/.claude/settings.json` at the
tag `v<version>`. `pnpm check` fails when any of these disagree.

Commit with `chore(tooling): release v0.0.3`.

## 2. Tag and push

```bash
git tag v0.0.3
git push origin main v0.0.3
```

Create the GitHub release from the tag with `gh release create v0.0.3 --generate-notes`, then edit
the notes so the first line says what changes for a repository that updates. The release notes page
`docs/reference/release-<version>.md` belongs in the release commit; `pnpm check` fails without it.

Other contributors depend on the standard staying predictable. A new rule ships as a warning in one
release and becomes a failure only in a later one: the next release while the standard is on 0.0.x,
and a later minor release from 0.1.0. The first release's notes say which release enforces it, so
every repository sees the warning in its own checks first.

## 3. Publish to GitHub Packages

Trigger the `Publish packages` workflow with the release tag. It publishes every `packages/*` to
`npm.pkg.github.com` under the `@williecubed` scope. Publishing is what rolls the release out:
repositories update to the newest version GitHub Packages has, never to a tag alone.

Nothing else is needed. Every repository runs its own `Standard update` workflow each day. When
GitHub Packages has a release newer than the version the repository pins `@williecubed/cli` to, it
opens one pull request on the branch `automation/repository-standard-<tag>`, using only that
workflow's own token:

- A template repository is regenerated from its example (`examples/basic` for
  [WillieCubed/template-basic](https://github.com/WillieCubed/template-basic), `examples/with-astro`
  for `template-with-astro`, and `examples/with-vite-react` for `template-with-vite-react`). These
  power GitHub's "Use this template" button.
- Every other repository moves every `@williecubed/*` dependency to the release and runs that
  release's own `cube update`, so the release's migrations apply in one pass however old the
  repository's current release is.

From 0.1.0, a patch release's pull request merges itself once `Validate` passes, and a minor
release's pull request waits for a maintainer to merge it, because a minor release can change how a
repository works. While the standard is on 0.0.x, every release can, so every update pull request
waits for a maintainer. A newer release closes the older pull requests it replaces, and an update
branch that fell behind `main` is rebuilt, unless someone pushed a fix to it. To roll a release out
sooner, run `Standard update` by hand in each repository's Actions tab.

A workflow's own token may not change workflow files. When a release changes one, such as an
example's `ci.yml`, the update still opens its pull request without that file, and the run fails and
names the file to copy by hand.

## 4. Watch the repositories update

The `Standard status` workflow inspects its own repository. Run the same optional host check locally
with `pnpm standards:status`, or select another destination with
`pnpm standards:status --repo OWNER/REPOSITORY --branch BRANCH`. There is no central project list,
registration step or membership requirement. Each repository owns its dependencies and update flow.

Add `--packages` to explicitly inspect a legacy consumer's pinned CLI, plugin reference and update
pull requests. Native projects and source examples do not acquire Node packages to participate in an
inventory. A repository that needs a shared-rule exception documents the reason, scope and review
condition in its own contributor guidance.

An update pull request that fails validation needs an actual fix and fresh verification before
integration. Current manual review requirements still apply. An update does not authorize
publication or a production deployment.

Do not cut a release to unblock one repository. Try an unreleased change there by linking a local
checkout, as [Installation and updates](../reference/installation.md#unreleased-changes) describes,
on a branch that is never merged.

Status reads the selected branch and inspects effective host protection. Ruleset and pull-request
discovery failures remain unknown and produce a finding; a matching ruleset name is not proof of
attachment or enforcement. Keep the project's local engineering checks independent of this optional
remote inspection. Do not resolve an unknown result by weakening checks or changing credentials
automatically.
