# Engineering rules

Rules for code in every repository on the standard. Each rule is a failing check where a machine can
check it; the rest are review rules and say so.

## Toolchain

| Concern      | Tool                                                             |
| ------------ | ---------------------------------------------------------------- |
| Runtime      | Node.js 24, required through `engines`                           |
| Packages     | pnpm through Corepack, pinned in `packageManager`                |
| Workspace    | Turborepo, with `apps/*` and `packages/*` even for one app       |
| Types        | TypeScript 6, strict base from `@williecubed/typescript-config`  |
| Lint         | ESLint with typescript-eslint, from `@williecubed/eslint-config` |
| Format       | Prettier, from `@williecubed/prettier-config`                    |
| Unit tests   | Vitest, from `@williecubed/vitest-config`                        |
| Browser      | Playwright, from `@williecubed/playwright-config`                |
| Git hooks    | The standard's `.githooks`, wired by `prepare`                   |
| Secrets scan | gitleaks, in pre-commit and CI                                   |

TypeScript stays on version 6 because typescript-eslint's type-aware rules do not run on TypeScript
7 yet. The [lint decision](../explanation/decisions/eslint-and-prettier.md) says when that changes.

## Types

Every package extends one strict base: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`, and unused-code checks. A TypeScript file outside every `tsconfig` is
a lint error.

## Lint

- The base is typescript-eslint's strict and stylistic type-checked sets, plus limits on file
  length, function length, nesting depth, parameter count, and complexity.
- Astro files use `eslint-plugin-astro`. MDX files use `eslint-plugin-mdx`, with code blocks linted.
- Zero warnings. Lint runs with `--max-warnings=0` everywhere.
- `no-console` allows `warn` and `error` only. `switch-exhaustiveness-check` is an error.
- `@ts-ignore` and `@ts-nocheck` are banned. `@ts-expect-error` needs a description.
- Existing findings in an adopting repository go into `eslint-suppressions.json`, and
  `cube check debt` fails if that ledger grows.

## Environment

- Each app parses its environment with a Zod schema at startup. A missing or malformed value stops
  the build or the Worker with a message naming the variable.
- Placeholder values that make a build pass are banned, and so are lazy wrappers that postpone the
  failure to the first request.
- A Turborepo environment variable is declared in the package that reads it, not in `globalEnv`.
- Local values live in gitignored `.dev.vars` or `.env.local` files. Agents are denied read access
  to them by `.claude/settings.json`.

## Errors

A person never sees an exception, a stack trace, an upstream provider's message, or a config value.
Code throws `PublicError` only when the message was written for a person. One boundary per app turns
errors into responses: a `PublicError` returns its message and status, and every other error is
logged once and answered with a fixed message. A test proves an error carrying a secret is logged
but never returned.

## Source control

A repository commits only what it owns and cannot regenerate: its source, its configuration, its
documentation, and its lockfile. It never commits another repository's code, build output, generated
files, or placeholders kept for things that do not exist yet. Shared code arrives as a pinned
dependency, as the
[GitHub Packages decision](../explanation/decisions/install-from-github-packages.md) records. A
reviewer asks of every added file whether this repository is its source.

## Dependencies

- One version catalog. Every repository's `pnpm-workspace.yaml` carries the catalog from
  `packages/cli/catalog.json`, and packages depend on `"catalog:"`. `cube check contract` warns when
  a repository pins a shared entry to another version, and fails from v0.8.0.
- The standard's own `@williecubed/*` packages install from GitHub Packages at one release's exact
  version, the same in every package of the workspace.
- Versions are exact and change only through the pnpm CLI or a standard update, never by editing a
  manifest by hand.
- A package version must be one day old before it installs (`minimumReleaseAge: 1440`). The
  standard's own packages are exempt (`minimumReleaseAgeExclude`), so a release installs the day it
  is published.
- Only packages on the `allowBuilds` list may run install scripts.
- CI installs with `--frozen-lockfile`.

## File and test layout

- Source and tests are `.ts` or `.tsx`. Tool configs use the format their tool requires.
- Tests live in each package's `tests/` directory, mirroring `src/`, never beside the code. Browser
  tests live in `tests/e2e/`.
- Imports use the `@/` alias instead of long relative paths.
- Named exports, except where a framework requires a default export.

## Review rules

These are not machine-checked. Reviewers hold them.

- **No types-only files.** Types live with the code they describe.
- **No inline magic values.** A fallback, limit, or name is a named constant.
- **No `constants.ts` files.** A constant with one consumer stays in that file. A constant shared by
  several files lives in a module named for its domain, such as `billing.ts`.
- **Right weight.** Build for the consumer that exists. Extract a shared package, abstraction, or
  config only when a second consumer needs it.

## Commits and pull requests

- Commit subjects follow Conventional Commits, at most 72 characters. Scopes come only from
  `.williecubed/commit-scopes.txt`. `feat` and `fix` commits need a body.
- Staging and committing happen in one command that first resets the index:
  `git restore --staged . && git add <paths> && git commit -F <file>`.
- Pull requests use the template from `WillieCubed/.github`: TL;DR, Changes, and Follow-ups and Next
  Work. They merge by rebase only.
