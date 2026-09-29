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

Commit with `chore(tooling): release v0.0.2`.

## 2. Tag and push

```bash
git tag v0.0.2
git push origin main v0.0.2
```

Create the GitHub release from the tag with `gh release create v0.0.2 --generate-notes`, then edit
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

The `Standard status` workflow runs daily. Its job summary lists each repository's release and open
update pull request, and it fails when a repository has drifted: behind the latest release for more
than three days, a `main` that pins `@williecubed/cli` to no release, a failing update pull request,
a contribution plugin ref that differs from the pinned release, a missing `org-standard` ruleset, or
no way to update itself (no `standard-update.yml`, or a `ci.yml` without `workflow_dispatch`). Run
the same check locally with `pnpm standards:status`.

A failing update pull request means the repository needs a change the update could not make. Fix it
on the update branch; the pull request then merges itself. A repository that must diverge from one
rule for a while records an exception in `standards/repositories.json` with the rule, a reason, and
an expiry date.

Do not cut a release to unblock one repository. Try an unreleased change there by linking a local
checkout, as [Installation and updates](../reference/installation.md#unreleased-changes) describes,
on a branch that is never merged.
