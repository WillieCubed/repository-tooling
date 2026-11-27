# Data handling

Rules for data every personal project stores. Each app records what it actually holds in its own
`docs/security/reference/data-inventory.md`, described in the
[documentation standard](documentation-standard.md#required-documents).

## Validation

Every value that crosses a trust boundary is validated before use: environment at startup, request
bodies and query strings on arrival, and structured stored values on read and write. TypeScript
applications use their approved schema validator; native applications keep equivalent validation in
their own language. A value that fails validation is rejected rather than silently coerced into
shape.

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

- Classify original durable records, objects and local stores separately from regenerable indexes
  and caches. Document backup coverage, retention and access controls for every durable class.
- Record numerical recovery time and recovery point objectives, backup frequency, actual restore
  windows and account/provider-loss dependencies in the existing operations guide.
- Retain required encryption/signing key versions under the documented custody model. An empty
  infrastructure rebuild or newly generated replacement key does not restore retained content.
- Restore representative data into an isolated environment before general availability and at least
  quarterly afterward. Verify usable content, permissions, required keys and recovery time. Keep
  external messages, billing, scheduled work and production integrations disabled in a drill.
- Reapply deletion and revocation records before exposing restored content, credentials or sync.
  Verify that recovery does not resurrect deleted data or revoked access.
- Document provider-native restore features and their actual coverage. Address recovery outside the
  failed account where the product's objectives require it; do not assume a provider restore window
  covers account loss or every object type.

See [rebuilding and recovery](../explanation/continuity.md) for the recovery order. These are
product requirements; shared setup does not implement a universal backup or restore operation.

## Exports

CSV exports follow RFC 4180 quoting and neutralize formula injection: a cell that starts with `=`,
`+`, `-`, `@`, a tab, or a carriage return is prefixed with `'`. Verify quoting and formula handling
in the actual export implementation. The previously proposed `@williecubed/data` package is not an
available implementation in this repository. Exports require authorization appropriate to their
contents; people may export their own data where the product offers that capability.

## Analytics

Analytics is Cloudflare Web Analytics, in production only. It sets no cookies and stores no IP
addresses. An app that needs product analytics beyond page views records that decision, and honors
Global Privacy Control and Do Not Track.

## Privacy page

An app with accounts or payments publishes `/privacy`, written from its `data-inventory.md`, so the
page and the inventory agree. It says what the app stores, why, for how long, and how to ask for
deletion.
