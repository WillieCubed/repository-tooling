# Repository tooling documentation

This documentation follows [Diátaxis](https://diataxis.fr): how-to guides complete one task,
reference pages record facts and contracts, and explanation gives the reasoning.

## How-to guides

- [Create a repository](how-to/create-a-repository.md)
- [Adopt the standard in an existing repository](how-to/adopt-in-an-existing-repository.md)
- [Set up a repository's production platform](how-to/set-up-production.md)
- [Publish a tooling release](how-to/publish-a-release.md)

## Reference

- [Admin](reference/admin.md)
- [Data handling](reference/data-handling.md)
- [Documentation standard](reference/documentation-standard.md)
- [Engineering rules](reference/engineering-rules.md)
- [Standard configuration](reference/standard-config.md)
- [Command reference](reference/cli.md)
- [Installation and updates](reference/installation.md)
- [Platform manifest reference](reference/platform-manifest.md)
- [The shared packages](reference/packages.md)
- [The example repositories](reference/examples.md)

## Explanation

- [Where a project runs](explanation/hosting.md)
- [Rebuilding from source](explanation/continuity.md)
- [Why admin sits behind two checks](explanation/security-model.md)
- [Why packages and examples](explanation/packages-and-examples.md)
- [Why production is declared in a platform manifest](explanation/production-platform.md)

### Decisions

- [Fork, not a shared engine](explanation/decisions/fork-not-engine.md)
- [One version catalog](explanation/decisions/one-catalog.md)
- [Install the standard from GitHub Packages](explanation/decisions/install-from-github-packages.md)
- [ESLint and Prettier](explanation/decisions/eslint-and-prettier.md)
- [Vercel apps keep admin on Workers](explanation/decisions/vercel-admin-on-workers.md)
- [Issue credentials again instead of storing them](explanation/decisions/issue-credentials-again.md)

## Design records

- [Personal repository standard](superpowers/specs/2026-09-28-personal-repository-standard-design.md)
