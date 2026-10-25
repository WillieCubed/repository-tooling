# Repository tooling 0.0.4

A repository that updates builds and checks without the warnings the standard caused: its catalog
moves to current releases, and pnpm stops warning that it cannot read the registry token, locally
and in CI.

- The catalog moves every entry to its current release that the examples' checks accept: Astro 7.4.2
  and Vite 8.3.5, Vitest 5.0.5, ESLint 10.13.0 and its plugins, Playwright 1.64.1, wrangler 4.152.0,
  Prettier 3.9.10 with `prettier-plugin-astro` 1.1.2, Turbo 2.11.10, React 19.3.1, the markdown
  linters, and the rest of the list in `catalog.json`. `cf` 1.0.0-beta.21 and
  `@cloudflare/vite-plugin` 2.0.0-beta.v.4 move together on `@cloudflare/config` 0.28.0. TypeScript
  stays on 6, the newest `@astrojs/check` supports, and `@types/node` stays on 24 with the runtime.
- Astro 7.4 drops a dead `use astro:head-inject` directive that made every Astro build print one
  `MODULE_LEVEL_DIRECTIVE` warning per MDX file
  ([withastro/astro#18088](https://github.com/withastro/astro/pull/18088)).
- `prettier-plugin-astro` 1.x prints `.astro` files differently. Run `pnpm format` once after the
  update; `pnpm check` names the files until then.
- The shared setup action exports the job's own token as `NODE_AUTH_TOKEN` for every step. pnpm
  reads the `.npmrc` that setup-node writes in each later step, and warned
  `Failed to replace env in config: ${NODE_AUTH_TOKEN}` in every one that ran without it. Steps that
  already set the token, such as `Standard update`'s, set the same value.
- `cube update` adds `NODE_AUTH_TOKEN` to `globalPassThroughEnv` in the root `turbo.json`, and the
  templates ship it. Turbo runs tasks without variables it isn't told about, so pnpm inside every
  task warned the same way, locally as well as in CI. A pass-through variable stays out of task
  hashes.
- The temporary security overrides add `undici` 7.30.1, which wrangler's miniflare does not select
  yet, and move `sharp` to 0.35.5.
- `@williecubed/eslint-config` and `@williecubed/playwright-config` move the plugins and Playwright
  pieces they pin to the same releases as the catalog.

A repository that is not a template gets the catalog, the `turbo.json` change and the action through
its `Standard update` pull request, except the action: a workflow's own token may not write it, so
copy `.github/actions/setup-node-pnpm/action.yml` from a template by hand, as for 0.0.3.

The three rules that 0.0.3 said would fail from v0.0.4 fail from v0.0.5 instead, because this
release moves every repository onto a new catalog first: the `.gitkeep` placeholder warning, the
re-pinned catalog entry warning, and the `ci` commit type warning. A repository that updates to this
catalog has no re-pinned entries left to warn about.
