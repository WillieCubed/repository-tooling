# Standard configuration

`standard.config.ts` at the root of this repository holds every value that ties the tooling to one
owner. The CLI, the templates, the updater, and the documentation examples read these values instead
of spelling them out. Changing an owner means changing this one file.

The Cloudflare values are defaults that a template writes into a new project's `platform.json`.
After that, the project's own manifest is the only place its production is configured. Nothing in
this repository configures a project.

| Key                     | Value                              | Used for                                              |
| ----------------------- | ---------------------------------- | ----------------------------------------------------- |
| `owner`                 | `WillieCubed`                      | GitHub owner of this repository and every consumer    |
| `npmScope`              | `@williecubed`                     | Package names and the GitHub Packages registry        |
| `cliName`               | `cube`                             | The command every repository's scripts call           |
| `stateDir`              | `.williecubed`                     | Where a repository keeps the files the standard reads |
| `pluginName`            | `willie-contributions`             | The Claude Code and Codex contribution plugin         |
| `bot.name`              | `cube-bot`                         | The author of every standard update commit            |
| `bot.email`             | `noreply@willie.page`              | How an update branch tells its own commits apart      |
| `cloudflare.accountId`  | `18f90fa11cf0a87145be4a1517e41217` | Default account for `platform.json`                   |
| `cloudflare.accessTeam` | `williecubed`                      | Access team, so `williecubed.cloudflareaccess.com`    |
| `cloudflare.zone`       | `willie.page`                      | Default zone for project subdomains                   |

A Cloudflare account id is an identifier, not a credential, so it is committed. API tokens never
are.

The file also derives the names built from these values: the commit scopes
`.williecubed/commit-scopes.txt`; this repository, `WillieCubed/repository-tooling`; the Claude Code
marketplace, named after the command; and the setup token variable `CUBE_CLOUDFLARE_SETUP_TOKEN`.

The standards scripts and the tests import the file. Two kinds of file cannot import it and carry
copies instead:

- The CLI runs from a consumer's `node_modules`, where Node does not strip TypeScript types, so
  `packages/cli/src/lib/standard.mjs` repeats the values.
- Shell hooks, JSON manifests, workflow YAML, the contribution plugin, and Markdown spell the values
  out.

`tests/standard-config.test.mjs` fails when a copy differs from `standard.config.ts`, and names the
file to change.

## Relationship to LVBT

This repository is a fork of `LasVegasForTransit/repository-tooling` at `v0.5.1`. In the upstream
repository the same values are written out in the code. The fork's first change moves them here.
Changes worth sharing are ported by hand in either direction. Merging the two into one engine with
one preset per owner waits until a second owner needs this repository, as recorded in
[Fork, not a shared engine](../explanation/decisions/fork-not-engine.md).
