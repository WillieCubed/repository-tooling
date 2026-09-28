# Repository tooling

The source of truth for the WillieCubed repository standard: the shape every personal repository
has, the commands it answers to, where it is hosted, how it handles data, and how its admin is
protected. It follows [Turborepo](https://turborepo.dev) conventions throughout.

This repository is a fork of
[LasVegasForTransit/repository-tooling](https://github.com/LasVegasForTransit/repository-tooling) at
`v0.5.1`. The values that tie it to one owner live in `standard.config.ts`;
[Standard configuration](docs/reference/standard-config.md) lists them.

It owns five things:

- the shared packages every repository depends on: `@williecubed/eslint-config`,
  `@williecubed/typescript-config`, `@williecubed/prettier-config`, `@williecubed/vitest-config`,
  `@williecubed/playwright-config`, and `@williecubed/cli` (the `cube` command for `bootstrap`,
  `preflight`, `check`, and `deploy`, the production platform setup, the git hooks, and the
  `willie-contributions` agent plugin);
- the security packages every app with admin or personal data uses: `@williecubed/access`,
  `@williecubed/edge-security`, `@williecubed/audit`, and `@williecubed/data`;
- the example repositories under `examples/` that the templates are published from;
- the issue forms and pull request template published by
  [`WillieCubed/.github`](https://github.com/WillieCubed/.github);
- the default-branch ruleset applied to every registered repository.

## The standard in brief

| Topic         | Rule                                                                                                                            | Details                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Hosting       | Cloudflare Workers by default; Vercel only when a feature needs it                                                              | [Where a project runs](docs/explanation/hosting.md)                |
| Admin         | Access at the edge, the token verified again in the Worker, failing closed, every change audited                                | [Admin](docs/reference/admin.md)                                   |
| Data          | Validated at every boundary, no lookup oracles, retention and restore documented, safe exports                                  | [Data handling](docs/reference/data-handling.md)                   |
| Documentation | Diátaxis inside domain directories, with required documents and sections                                                        | [Documentation standard](docs/reference/documentation-standard.md) |
| Code          | Strict TypeScript, ESLint and Prettier with Astro and MDX, one version catalog, zero warnings                                   | [Engineering rules](docs/reference/engineering-rules.md)           |
| Production    | Declared in `platform.json`, checked and set up by one idempotent command                                                       | [Platform manifest](docs/reference/platform-manifest.md)           |
| Continuity    | Each project's source is enough to set up its production again in minutes; no secret is stored outside the services that use it | [Rebuilding from source](docs/explanation/continuity.md)           |

## Create a repository

Press **Use this template** on the template that matches what the repository ships: `template-basic`
for libraries, CLIs, and Workers; `template-with-astro` for an Astro site;
`template-with-vite-react` for a Vite and React application. Or, from a terminal:

```bash
gh repo create WillieCubed/<your-repo> --template WillieCubed/template-basic --private --clone
cd <your-repo>
pnpm bootstrap
pnpm check
```

Each template is published from the matching directory under `examples/` on every release. Inside a
repository, `pnpm standards:update --release <tag> --apply` reviews and applies a newer standard.

## Every repository answers to the same commands

| Command                       | What it does                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| `pnpm bootstrap`              | Install dependencies, wire git hooks, and run preflight             |
| `pnpm preflight`              | Confirm the machine can build and deploy this repository            |
| `pnpm preflight --production` | Report whether production has everything `platform.json` declares   |
| `pnpm bootstrap --production` | Set up whatever production is missing, asking for values as it goes |
| `pnpm check`                  | Format check, then lint, typecheck, and tests through Turborepo     |
| `pnpm check:fix`              | Apply formatting and lint fixes                                     |
| `pnpm build`                  | Build every package                                                 |
| `pnpm run deploy`             | Build, then `wrangler deploy` (deployable repositories)             |
| `pnpm test`                   | Run every package's tests                                           |

Guides, the command reference, and the package reference are in [`docs/`](docs/README.md).

## Working on this repository

```bash
pnpm check
```

It formats, lints, and runs every test under `tests/`, including one that copies each example into a
temporary directory and proves it passes its own checks with the shared packages. This repository
consumes its own packages and hooks. A repository that needs to weaken a shared rule records an
exception with a reason and an expiry date in
[`standards/repositories.json`](standards/repositories.json).
