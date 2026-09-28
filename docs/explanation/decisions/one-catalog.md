# One version catalog

Decided 2026-09-28.

## Decision

Every personal repository uses one pnpm version catalog, identical to `packages/cli/catalog.json`,
and packages depend on `"catalog:"`. Versions stay exact. `cube check contract` fails when a
repository's catalog differs, and a standard update changes every repository's versions in one
reviewed pull request.

## Why

The shared ESLint, TypeScript, and Astro configs are tested against specific tool versions. With a
different version of `typescript-eslint` or `astro` in each repository, a rule change in the
standard can pass here and fail in a consumer. One catalog makes the tested set and the installed
set the same.

## Rejected

- **Exact pins with no catalog**, the rule Nerve used. Each repository was reproducible on its own,
  but versions drifted between repositories, and a shared config could not be tested against the
  versions consumers actually ran.

## Consequences

Nerve's `docs/16-engineering-standards.md` says not to use catalogs. That rule is replaced when
Nerve adopts the standard.
