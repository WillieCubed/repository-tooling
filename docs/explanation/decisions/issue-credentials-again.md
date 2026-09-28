# Issue credentials again instead of storing them

Decided 2026-09-28.

## Decision

The standard stores no secret values outside the services that use them. Each secret in a project's
manifest is minted by setup, derived from a resource setup creates, or issued again by a person from
the manifest's steps when production is rebuilt.

## Why

The goal is that a project's infrastructure can always be set up again from its source, not that
every past value survives. Once data is out of scope, most secrets have nothing to preserve: minted
keys signed records that no longer exist, and derived values come back when their resource is
created again. What remains is a few values per project, each of which a person can issue again in
under a minute by following the manifest's steps. Storing them would add a second system to keep
safe, back up, and recover, for values that are cheaper to replace.

## Rejected

- **SOPS and age, with encrypted values committed.** One private key would unlock everything, so the
  key would need its own backup and rotation plan, and every rotation would rewrite committed files.
- **References into a password manager.** It makes a rebuild depend on one more service, and no
  password manager with a command-line interface is in use.
- **A central inventory of credentials shared by all projects.** Projects are independent; a
  project's source alone must be enough to rebuild it.

## Consequences

- Signed links, sessions, and API keys from before a rebuild stop working after it. That is
  acceptable because the data they belonged to is not restored.
- A typed secret is a cost paid on every rebuild. A project that can use a minted or derived value
  instead must.

## Revisit

Revisit if restoring data becomes part of a rebuild, because restored records would need the keys
that signed them.
