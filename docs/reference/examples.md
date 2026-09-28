# The example repositories

Each directory under `examples/` is a complete Turborepo workspace that `create-turbo` copies to
start a new repository, and that a template repository mirrors. It is the standard, in runnable
form: a test in this repository copies each example into a temporary directory and proves it passes
its own `check` with the shared packages.

| Example           | For                                                 | Template repository        |
| ----------------- | --------------------------------------------------- | -------------------------- |
| `basic`           | A library, CLI, or Cloudflare Worker workspace      | `template-basic`           |
| `with-astro`      | An Astro site deployed to Cloudflare Workers        | `template-with-astro`      |
| `with-vite-react` | A Vite and React application deployed to Cloudflare | `template-with-vite-react` |

## What `examples/basic` contains

| Path                                         | Purpose                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `package.json`                               | The standard scripts, lint-staged, and the `@williecubed/cli` and Prettier deps at the release   |
| `.npmrc`                                     | The `@williecubed` scope's registry, GitHub Packages                                             |
| `pnpm-workspace.yaml`                        | `apps/*`, `packages/*`, the release age rules, and the version catalog                           |
| `turbo.json`                                 | `build`, `lint`, `check-types`, `test`, `test:e2e`, `dev` tasks                                  |
| `prettier.config.js`                         | Extends `@williecubed/prettier-config`                                                           |
| `.markdownlint-cli2.jsonc`                   | Documentation rules, including that every relative link resolves                                 |
| `.gitleaks.toml`                             | Secret scanning exemptions for the lockfile and design records                                   |
| `.githooks/`                                 | Stubs that run the shared hooks from `node_modules/@williecubed/cli`                             |
| `.codex/hooks.json`, `.agents/plugins/`      | Codex loads the plugin from `node_modules` and runs its guard                                    |
| `.claude/settings.json`                      | Claude Code loads the plugin from the release tag, formats on edit, and cannot read secret files |
| `.github/workflows/ci.yml`                   | The `Validate` job: `pnpm check`, dependency audit, secret scan                                  |
| `.github/workflows/standard-update.yml`      | Daily: `cube self-update` opens a pull request when GitHub Packages has a newer release          |
| `.github/actions/setup-node-pnpm/action.yml` | Node from `package.json`, pinned pnpm, frozen install                                            |
| `.github/renovate.json`                      | Weekly grouped updates; `@williecubed/*` bumps grouped as one                                    |
| `.github/CODEOWNERS`                         | The owner reviews everything                                                                     |
| `.williecubed/commit-scopes.txt`             | Placeholder scopes to replace                                                                    |
| `docs/`                                      | The index, a start-here tutorial, and a glossary                                                 |
| `AGENTS.md`, `README.md`                     | Agent guidance and the repository's own front page                                               |
| `packages/example/`                          | A sample package with `lint`, `check-types`, `test`, `build`                                     |

`pnpm-workspace.yaml` lists `apps/*` even though `basic` has no app yet. pnpm and Turborepo accept a
glob with nothing under it, and `turbo gen workspace` creates the directory with the first app, so
no placeholder file holds it. The deployable examples have no `packages/` directory for the same
reason.

The `.githooks/` stubs, the Codex files, the setup action, and `.editorconfig` are the standard's
own files: `@williecubed/cli` carries the same copies, and `cube check owned` holds every repository
to them. [Installation and updates](installation.md#files-the-standard-owns) lists them.

The example is the authoritative source for its template repository. Publication copies it at the
release tag, unchanged, after checking that every `@williecubed/*` dependency and the plugin ref
name that release. Running publication again for the same tag produces the same files.

## What the deployable examples add

`with-astro` and `with-vite-react` carry everything above, minus `packages/example`, plus:

| Path                           | Purpose                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `apps/site` or `apps/app`      | The application: source under `src/`, unit tests under `tests/`, end-to-end tests under `tests/e2e/` |
| `apps/*/wrangler.jsonc`        | A static-assets Worker serving `dist/`; `pnpm run deploy` deploys every app that has one             |
| `apps/*/playwright.config.ts`  | Spreads `@williecubed/playwright-config` and starts the app's `preview` server                       |
| `.github/workflows/deploy.yml` | Validates, then runs `pnpm run deploy` on every push to `main` with the Cloudflare secrets           |
| root `preview` and `deploy`    | `turbo run preview` and `cube deploy`                                                                |

The Astro example also adds `prettier-plugin-astro` to its Prettier config and extends
`@williecubed/typescript-config/astro.json`; the React example extends `react-library.json` and
lints with `@williecubed/eslint-config/react-internal`.

The Astro site has a `sync` script that runs `astro sync`, and the Astro example's `turbo.json` has
a `sync` task that `lint` depends on. Astro generates the types for `astro:content` and its
environment only when it syncs or builds, so on a clean checkout, as in CI, type-aware lint rules
would otherwise reject every module that imports them. Turbo caches the generated `.astro/`
directory, so the extra task costs nothing when the content hasn't changed. The React example's
`turbo.json` has no `sync` task, because nothing in it runs `astro sync`; `cube update` adds the
task to any repository that gains an Astro package.

## Adding an example

Copy `examples/basic`, change what the profile needs, and add it to the table above, to the
`examples` map in `tests/example.test.mjs` so it is proven on every check, and to
`standards/repositories.json` as a `template` with its `example`, so each release publishes it. Keep
the standard scripts and the catalog identical across examples.
