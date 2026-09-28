# Standard configuration

`standard.config.ts` at the root of this repository holds every value that ties the tooling to one
owner. The CLI, the templates, the updater, and the documentation examples read these values instead
of spelling them out. Changing an owner means changing this one file.

The Cloudflare values are defaults that a template writes into a new project's `platform.json`.
After that, the project's own manifest is the only place its production is configured. Nothing in
this repository configures a project.

| Key                     | Value                              | Used for                                           |
| ----------------------- | ---------------------------------- | -------------------------------------------------- |
| `owner`                 | `WillieCubed`                      | GitHub owner of this repository and every consumer |
| `npmScope`              | `@williecubed`                     | Package names and the GitHub Packages registry     |
| `cliName`               | `willie`                           | The command every repository's scripts call        |
| `preset`                | `willie-web`                       | The preset name recorded in each snapshot          |
| `vendorDir`             | `.williecubed/web-platform`        | Where a consumer keeps the vendored snapshot       |
| `pluginName`            | `willie-contributions`             | The Claude Code and Codex contribution plugin      |
| `cloudflare.accountId`  | `18f90fa11cf0a87145be4a1517e41217` | Default account for `platform.json`                |
| `cloudflare.accessTeam` | `williecubed`                      | Access team, so `williecubed.cloudflareaccess.com` |
| `cloudflare.zone`       | `willie.page`                      | Default zone for project subdomains                |

A Cloudflare account id is an identifier, not a credential, so it is committed. API tokens never
are.

## Relationship to LVBT

This repository is a fork of `LasVegasForTransit/repository-tooling` at `v0.5.1`. In the upstream
repository the same values are written out in the code. The fork's first change moves them here.
Changes worth sharing are ported by hand in either direction. Merging the two into one engine with
one preset per owner waits until a second owner needs this repository, as recorded in
[Fork, not a shared engine](../explanation/decisions/fork-not-engine.md).
