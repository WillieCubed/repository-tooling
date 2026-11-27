# Recover credentials according to their purpose

## Decision

Reissue replaceable access credentials through the provider's supported path. Preserve keys and
other recovery material required to use retained data, or provide an explicit compatible migration.
Each project's operations guide defines custody, recovery, rotation and revocation for those values.

The earlier rule to issue every credential again applied only to disposable rebuilds that restored
no data. It must not govern recovery of a durable product. Source describes infrastructure and
non-secret recovery references; secret values stay in the approved custody system.

## Why

Deploy tokens can usually be replaced without changing stored content. Encryption keys can be
irreplaceable, and signing keys may be needed to validate retained records or links. Treating both
as disposable can leave a recovered database unreadable or silently change the meaning of its
authorization state.

Backing up required key material introduces a real custody dependency. State that dependency and
test it, including recovery from a replacement device. Keep recovery access separate from ordinary
application writes and preserve the minimum key versions required by the retention policy.

## Alternatives

- Reissuing everything remains appropriate for explicitly disposable environments with synthetic
  data. It does not establish durable recovery.
- An approved secret manager or encrypted recovery store may hold required material. Choose the
  mechanism from the project's threat model and actual operator access; do not mandate a new vendor
  merely for consistency.
- A compatible key migration may replace an old key after retained data and signed records are
  handled correctly. Verify the migration and revocation behavior before retiring the old material.

## Consequences

- Missing required keys block restoration; setup must not substitute new random values for them.
- Session invalidation is an explicit recovery choice, with a usable account recovery path.
- Backups and key custody have documented retention and access controls. Deletion and revocation
  records must be replayed before restored content or credentials become available.
- Recovery acceptance requires an isolated restore and usable-content checks, not just successful
  provisioning or a backup receipt.

## Revisit

Review when a product adds retained data, changes its encryption or signing model, changes custody
providers, or changes its recovery objectives. See [rebuilding and recovery](../continuity.md).
