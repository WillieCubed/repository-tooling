# Repository tooling

Personal ownership configuration and compatibility tooling for adopting the Hypertext Studio
engineering and product baseline. Products retain their purpose, authorship, provider destinations
and native toolchains. Multi-package JavaScript workspaces use pnpm and Turborepo; native projects
keep their own language's setup, build and verification commands.

This repository originated as a fork of
[LasVegasForTransit/repository-tooling](https://github.com/LasVegasForTransit/repository-tooling) at
`v0.5.1`. The values that tie it to one owner live in `standard.config.ts`;
[Standard configuration](docs/reference/standard-config.md) lists them. Shared generic behavior is
moving to Studio tooling, with legacy personal packages retained until equivalent behavior and
clean-checkout access are verified. This source does not certify that every Personal product has
completed adoption.

It owns the following tooling:

- the legacy packages JavaScript consumers install from GitHub Packages at one exact release:
  `@williecubed/eslint-config`, `@williecubed/typescript-config`, `@williecubed/prettier-config`,
  `@williecubed/vitest-config`, `@williecubed/playwright-config`, and `@williecubed/cli` (the `cube`
  command for `bootstrap`, `preflight`, `check`, `deploy`, and `update`, the production platform
  setup, the git hooks, the files every repository keeps identical, and the `willie-contributions`
  agent plugin);
- the example repositories under `examples/` that the templates are published from;
- the issue forms and pull request template published by
  [`WillieCubed/.github`](https://github.com/WillieCubed/.github);
- the default-branch ruleset definition and repository status checks. Actual host enforcement
  requires supported account capabilities and verified activation.

The security requirements describe behavior each application must implement and verify. The
previously proposed `access`, `edge-security`, `audit` and `data` packages do not exist here; their
names are not evidence of an installed security implementation.

## The standard in brief

| Topic          | Rule                                                                                                                                           | Details                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Hosting        | Cloudflare Workers by default; Vercel only when a feature needs it                                                                             | [Where a project runs](docs/explanation/hosting.md)                        |
| Admin          | Access at the edge, the token verified again in the Worker, failing closed, every change audited                                               | [Admin](docs/reference/admin.md)                                           |
| Data           | Validated at every boundary, no lookup oracles, retention and restore documented, safe exports                                                 | [Data handling](docs/reference/data-handling.md)                           |
| Documentation  | Diátaxis inside domain directories, with required documents and sections                                                                       | [Documentation standard](docs/reference/documentation-standard.md)         |
| Code           | Strict TypeScript, ESLint and Prettier with Astro and MDX, one version catalog, zero warnings                                                  | [Engineering rules](docs/reference/engineering-rules.md)                   |
| Production     | Declared in `platform.json`, checked and set up by one idempotent command                                                                      | [Platform manifest](docs/reference/platform-manifest.md)                   |
| Continuity     | Recover durable data, required keys and deletion/revocation state through a rehearsed project-owned procedure                                  | [Rebuilding and recovery](docs/explanation/continuity.md)                  |
| Identity       | Every web project links to willie.page with one author link and its head tag, from `@williecubed/brand`                                        | [Identity](docs/reference/identity.md)                                     |
| Infrastructure | Account-unique names start with the Worker name, no `workers.dev` copies, zone-wide settings belong to the zone, unlisted sites send `noindex` | [Infrastructure conventions](docs/reference/infrastructure-conventions.md) |
| Resources      | Each app documents its limits, paid endpoints are guarded, each provider caps each project, and local disk is kept clean                       | [Resource usage](docs/reference/resource-usage.md)                         |

## Create a repository

Installing the `@williecubed/*` packages needs a GitHub token with `read:packages`;
[Installation and updates](docs/reference/installation.md#authentication) sets one up. Then press
**Use this template** on the template that matches what the repository ships: `template-basic` for
libraries, CLIs, and Workers; `template-with-astro` for an Astro site; `template-with-vite-react`
for a Vite and React application. Or, from a terminal:

```bash
gh repo create WillieCubed/<your-repo> --template WillieCubed/template-basic --private --clone
cd <your-repo>
pnpm bootstrap
pnpm check
```

Each template is published from the matching directory under `examples/` on every release. Every
repository's daily `Standard update` workflow opens a pull request that moves it to each newer
release.

## Web workspace commands

These are the legacy pnpm workspace entrypoints. Native-only projects use their real commands for
the same setup, development, build, test, lint and typecheck meanings. They do not acquire Node,
Turborepo or an empty workspace merely to match a command spelling.

| Command                       | What it does                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| `pnpm bootstrap`              | Install dependencies, wire git hooks, and run preflight             |
| `pnpm preflight`              | Confirm the machine can build and deploy this repository            |
| `pnpm preflight --production` | Report whether production has everything `platform.json` declares   |
| `pnpm bootstrap --production` | Set up whatever production is missing, asking for values as it goes |
| `pnpm check`                  | Format check, then lint, typecheck, and tests through Turborepo     |
| `pnpm check:fix`              | Apply formatting and lint fixes                                     |
| `pnpm build`                  | Build every package                                                 |
| `pnpm run deploy`             | Build, then `cf deploy` (`wrangler deploy` for a legacy app)        |
| `pnpm test`                   | Run every package's tests                                           |

Guides, the command reference, and the package reference are in [`docs/`](docs/README.md).

## Working on this repository

```bash
pnpm check
```

It formats, lints, and runs every test under `tests/`, including one that copies each example into a
temporary directory and proves it passes its own checks with the shared packages. This repository
consumes its own packages and hooks. Each project owns its configuration and native commands; there
is no central project registration requirement. Document any necessary exception where that
repository's contributors can understand its reason, scope and review condition.
