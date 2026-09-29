# Data handling

Rules for data every personal project stores. Each app records what it actually holds in its own
`docs/security/reference/data-inventory.md`, described in the
[documentation standard](documentation-standard.md#required-documents).

## Validation

Every value that crosses a trust boundary is parsed with a Zod schema before use: environment at
startup, request bodies and query strings on arrival, and structured values stored as JSON on every
read and every write. A value that fails parsing is rejected. It is never coerced into shape.

## Storage choice

| Data                            | Store                        |
| ------------------------------- | ---------------------------- |
| Records on a Cloudflare app     | D1                           |
| Records on a Vercel app         | Neon Postgres, with Drizzle  |
| Files                           | R2                           |
| Cache and short-lived config    | KV, never the only copy      |
| Per-entity state that must sync | Durable Objects, with SQLite |

D1 is used through prepared statements or Drizzle; the app picks one and does not mix them.

## Migrations

- Migrations are append-only. A shipped migration is never edited; a correction is a new migration.
  `cube check migrations` enforces it.
- A migration ships in the same commit as the feature that needs it.
- D1 migrations do not contain `BEGIN` or `COMMIT`, because D1 wraps each migration in a
  transaction.
- Timestamps are ISO 8601 strings written by app code. Columns do not default to
  `CURRENT_TIMESTAMP`, so tests control time.
- A migration opens with a comment saying why the change exists.
- Migrations apply before the deploy that needs them, in the same CI job.

## Personal data

- **No lookup oracles.** A public path never finds a record by a person's email, name, or phone
  number. A lookup by email lets anyone with the link test whether a named person is present.
- **Indistinguishable failures.** A bad token answers 404, not 403. Insert and update give the same
  response. A constraint error gives a message that names no field value.
- **Signed, purpose-bound tokens.** Tokens are HMAC signatures over a purpose prefix and the record
  id, compared in constant time. Session and link tokens are stored as SHA-256 hashes, never as
  issued.
- **Redaction by type.** A page that shows records to someone other than the owner receives a
  redacted type, produced by one function, so skipping redaction is a type error.
- **Least copying.** Data from another service, such as contacts or calendar attendees, is read live
  or kept as the latest snapshot only. It is not bulk-copied.

## Logs

- Logs are structured JSON lines, one per event, with no personal data in them.
- When a URL carries a token, the Worker's invocation logs are off, because they record full URLs.
- Errors shown to people come from one boundary that shows only messages written for them. Every
  other error is logged and answered with a fixed message.

## Caching

Any response personalized to one person, and every admin response, is sent `private, no-store`.

## Retention and deletion

Every table that holds personal data has a retention period in the app's data inventory and a way to
delete it: a scheduled cleanup, an admin action, or both. A table with no retention period is a
finding, not a default of forever. Deleting a record deletes its copies in caches and R2.

## Backups and restore

- D1 relies on Time Travel for point-in-time restore. The restore command and its window are in the
  app's `operations.md` under Restore, and the restore is run once against a copy before the app
  launches.
- Neon relies on its point-in-time restore, with the same documentation and one rehearsal.
- R2 objects that cannot be recreated are listed in the data inventory with how they are backed up.

## Exports

CSV exports follow RFC 4180 quoting and neutralize formula injection: a cell that starts with `=`,
`+`, `-`, `@`, a tab, or a carriage return is prefixed with `'`. `toCsv` in `@williecubed/data` does
both. Exports are admin-only.

## Analytics

Analytics is Cloudflare Web Analytics, in production only. It sets no cookies and stores no IP
addresses. An app that needs product analytics beyond page views records that decision, and honors
Global Privacy Control and Do Not Track.

## Privacy page

An app with accounts or payments publishes `/privacy`, written from its `data-inventory.md`, so the
page and the inventory agree. It says what the app stores, why, for how long, and how to ask for
deletion.
