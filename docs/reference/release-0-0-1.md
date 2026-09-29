# Repository tooling 0.0.1

The first release of the WillieCubed repository standard. A repository starts on it from
`template-basic`, `template-with-astro`, or `template-with-vite-react`, or adopts it by following
[Adopt the standard in an existing repository](../how-to/adopt-in-an-existing-repository.md). No
repository updates to it from an earlier release.

A repository on 0.0.1 gets:

- the `@williecubed/*` packages from GitHub Packages at `0.0.1`, like any other dependency, with
  `minimumReleaseAgeExclude: ['@williecubed/*']` in `pnpm-workspace.yaml` so a release installs the
  day it is published. Installing needs a token with `read:packages`, as
  [Installation and updates](installation.md#authentication) describes, and `cube preflight` fails
  `GitHub Packages` when pnpm has none;
- the `cube` command behind `pnpm bootstrap`, `pnpm preflight`, `pnpm check`, and `pnpm run deploy`,
  which reads the Cloudflare setup token from `CUBE_CLOUDFLARE_SETUP_TOKEN` when it runs without a
  terminal;
- the files every repository keeps identical, carried by `@williecubed/cli`: the `.githooks/*`
  stubs, `.codex/hooks.json`, `.agents/plugins/marketplace.json`,
  `.github/actions/setup-node-pnpm/action.yml`, and `.editorconfig`. `cube update` writes them, and
  `cube check owned` fails when one differs from the installed copy, when a `.prettierrc` file
  replaces `prettier.config.js`, or when the contribution plugin loads from another release;
- its commit scopes in `.williecubed/commit-scopes.txt`;
- the `willie-contributions` plugin from the `cube` marketplace, whose helper writes pull requests
  with TL;DR, Changes, and Follow-ups and Next Work;
- a daily `Standard update` workflow that runs `cube self-update` and opens one pull request for
  each newer release. While the standard is on 0.0.x, every release can change how a repository
  works, so every update pull request waits for a maintainer.

Every value that names the owner comes from [`standard.config.ts`](standard-config.md).

Three rules only warn, and v0.0.2 will enforce them. Fix what they report before then:

- `cube check filenames` warns about a `.gitkeep` or `.keep` placeholder. A repository commits no
  file for a directory that has nothing in it yet; pnpm and Turborepo accept a workspace glob with
  nothing under it.
- `cube check contract` warns about a shared catalog entry in `pnpm-workspace.yaml` pinned to a
  different version than the standard's catalog. From v0.0.2 the update moves those entries and the
  check fails on any that differ.
- The commit hook warns about `ci` as a commit type or scope; use `chore`. From v0.0.2 the hook
  rejects it.
