# Fork, not a shared engine

Decided 2026-09-28.

## Decision

The personal standard is a fork of `LasVegasForTransit/repository-tooling` at `v0.5.1`, owned by
`WillieCubed`. Every owner-specific value moves into `standard.config.ts`. LVBT's repository is not
changed.

## Why

LVBT's tooling already does what the personal projects lack: vendored, hash-checked snapshots, daily
self-update pull requests, a drift report, templates, and a production manifest. The mechanism is
general, but its owner, npm scope, command name, paths, and Cloudflare account are written out
across the code. Forking and moving those values into one file gets the personal projects the whole
mechanism now, without changing LVBT's release process.

## Rejected

- **A shared engine with one preset per owner.** It would change LVBT's repository and every LVBT
  consumer to serve one new owner. Shared scope comes after a second consumer, not before.
- **A new standard built from scratch.** It would repeat solved problems: integrity hashing,
  idempotent production setup, and update migrations.
- **Adopting LVBT's packages directly.** The rules would follow LVBT's organization and release
  approvals, and personal repositories would carry LVBT's name.

## Revisit

When a third owner, such as TheHypertextStudio, wants the same mechanism, extract the engine and
make LVBT and the personal standard its first two presets.
