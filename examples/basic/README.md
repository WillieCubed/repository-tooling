# Package repository

A Turborepo workspace following the WillieCubed repository standard. It was created with:

```bash
npx create-turbo@latest --example https://github.com/WillieCubed/repository-tooling/tree/main/examples/basic
```

## Getting started

```bash
pnpm bootstrap   # install, wire git hooks, run preflight
pnpm check       # the same check CI runs
```

Then rename the root package and `packages/example`, and replace the scopes in
`.williecubed/commit-scopes.txt` with this repository's boundaries.

## Layout

- `apps/` for deployable applications and services
- `packages/` for libraries and tools; `packages/example` shows the shape of one

Lint, format, TypeScript, and test settings extend the `@williecubed/*` packages from
[`WillieCubed/repository-tooling`](https://github.com/WillieCubed/repository-tooling).
