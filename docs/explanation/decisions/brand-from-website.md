# Publish the brand package from willie.page

Decided 2026-09-28.

## Decision

`@williecubed/brand` is published from the website repository, beside the build that generates the
willie.page kit. It installs like every other `@williecubed/*` package, pinned to an exact version.

## Why

The kit has one source: the website's brand build already generates every mark, favicon, and color
token. Publishing from there keeps a kit change to one repository, and a repository commits only
what it owns. Until now the mark and colors were copied by hand into projects, and the copies
drifted: reports' copy of the mark grew an option WPP's lacks.

## Rejected

- **Publishing from repository-tooling** with the other packages. One release pipeline would deliver
  it, but this repository would commit a copy of another repository's source, and every kit change
  would need two changes.
- **A documented snippet and no package.** That is how the copies drifted.

## Consequences

The website repository gains a `packages/brand` directory and a GitHub Packages publish workflow,
which fits the Turborepo shape it adopts with the standard. Projects receive brand updates through
their dependency update pull requests, not the standard's update.
