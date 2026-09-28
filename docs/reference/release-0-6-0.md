# Repository tooling 0.6.0

The first release of the WillieCubed repository standard. A repository starts on it from
`template-basic`, `template-with-astro`, or `template-with-vite-react`, or adopts it by following
[Adopt the standard in an existing repository](../how-to/adopt-in-an-existing-repository.md). No
repository updates to it from an earlier release.

A repository on 0.6.0 gets:

- the `@williecubed/*` packages, vendored under `.williecubed/web-platform` with their provenance in
  `.williecubed/web-platform.json`, so installing needs no registry login;
- the `cube` command behind `pnpm bootstrap`, `pnpm preflight`, `pnpm check`, and `pnpm run deploy`,
  which reads the Cloudflare setup token from `CUBE_CLOUDFLARE_SETUP_TOKEN` when it runs without a
  terminal;
- its commit scopes in `.williecubed/commit-scopes.txt`;
- the `willie-contributions` plugin from the `cube` marketplace, whose helper writes pull requests
  with TL;DR, Changes, and Follow-ups and Next Work;
- a daily `Standard update` workflow that opens a pull request for each newer release.

Every value that names the owner comes from [`standard.config.ts`](standard-config.md).

Three rules only warn, and v0.7.0 will enforce them. Fix what they report before then:

- `pnpm standards:check` warns about files the standard owns that the repository changed:
  `.githooks/*`, `.codex/hooks.json`, `.agents/plugins/marketplace.json`,
  `.github/actions/setup-node-pnpm/action.yml`, and `.editorconfig`, and about a `.prettierrc` file
  that replaces `prettier.config.js`. From v0.7.0 the check fails and the update restores the
  standard's copies.
- `cube check contract` warns about a shared catalog entry in `pnpm-workspace.yaml` pinned to a
  different version than the standard's catalog. From v0.7.0 the update moves those entries and the
  check fails on any that differ.
- The commit hook warns about `ci` as a commit type or scope; use `chore`. From v0.7.0 the hook
  rejects it.
