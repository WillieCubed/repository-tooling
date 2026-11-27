# Rebuilding and recovering a project

Source and reviewed configuration describe how to recreate a project's infrastructure. Recovering an
existing product also requires its retained data, required key material, and deletion and revocation
records. Recreating an empty database does not recover the product.

Each project owns its recovery procedure. Another personal project, a private agent plugin, or a
Studio account must not be an undocumented prerequisite. Accounts, domains, credentials, provider
access and backups that the procedure needs are explicit dependencies.

## Choose the recovery outcome

| Outcome                                   | What must survive                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Disposable development or preview rebuild | Reviewed source and configuration; synthetic state can be discarded intentionally                                             |
| Durable product recovery                  | User content, ownership and permissions, required keys, deletion/revocation state, and compatible application/schema versions |

A project identifies which environments are disposable. Production data is not disposable merely
because the project is personal, has one operator, or can provision its infrastructure again.
Deleting an environment, rotating keys or abandoning retained data requires an explicit incident or
retirement decision.

## Infrastructure setup

The existing web setup commands prepare dependencies, inspect configuration and provision the
resources supported by the project's manifest:

```bash
pnpm bootstrap
pnpm preflight --production
pnpm bootstrap --production
```

Inspect the proposed account, environment and operations before applying production setup. Native
projects keep their native setup commands. These commands do not by themselves restore a backup,
recover encryption keys, establish a usable product or prove a recovery-time objective. A project
documents any required manual provider steps honestly.

## Credentials and keys

Where a secret comes from and whether it must survive recovery are separate questions. A value may
be generated locally, returned by provisioning, or issued by a person. Each still needs a purpose,
environment, custody rule and recovery behavior.

- Replace deploy tokens and other replaceable credentials through their supported issuance path.
  Revoke old credentials and verify the replacement with the least required access.
- Preserve encryption keys and signing keys needed by retained records in the project's approved
  secret store or encrypted recovery material, with access separate from ordinary application
  writes. Keep the required key versions and a tested way to recover them from a replacement device.
- Replace session or link-signing keys only when the recovery procedure deliberately invalidates the
  affected sessions or links, preserves account recovery, and verifies that revoked credentials
  cannot become valid again. Retained signed records may require the original key or a compatible
  migration.
- Never put plaintext secrets, private keys or recovery material in source, issue descriptions,
  logs, screenshots or public examples. Source may name a non-secret recovery reference.

Missing required keys block durable restoration. Generating new random bytes with the same secret
name is not a recovery strategy. See the
[credential recovery decision](decisions/issue-credentials-again.md).

## Recovery order

The project's existing operations guide records the actual commands and their prerequisites:

1. Identify the incident, recovery point, exact destination and authorized operator. Preserve the
   remaining source and recovery material; do not overwrite the only usable copy.
2. Establish an isolated environment with outbound messages, billing, webhooks, scheduled work and
   other real-world effects disabled. Production credentials must not cross into a less trusted
   environment merely to run the drill.
3. Recover the compatible application/schema versions, required key versions and representative
   retained data. Verify integrity and ownership before applying new migrations.
4. Reapply deletion and revocation records before exposing restored data or re-enabling sync. Verify
   that deleted content stays deleted and restricted accounts or credentials stay restricted.
5. Exercise the important user journeys and confirm readable content, authorization, writes and
   recovery behavior. A backup-success message or an answering homepage is insufficient.
6. For an authorized production recovery, follow the project's cutover and rollback procedure,
   reconcile writes after the chosen recovery point, and verify the actual service afterward.

This ordering is a recovery contract, not a claim that a shared restore command exists. Each durable
project must implement and rehearse its own provider-appropriate procedure.

## Objectives and evidence

For each critical journey or data class, record numerical recovery point and recovery time
objectives, backup frequency and retention, restore prerequisites, and the measurement window.
Consider loss of the provider account as well as ordinary mistakes within a working account.
Provider-native restore features need their actual coverage and limits documented; they are not
automatically an independent recovery copy.

Before general availability and at least quarterly afterward, restore representative data into an
isolated environment and measure the result. Retain concise recovery evidence outside public source:
the selected recovery point, usable-content and permission checks, deletion/revocation checks,
elapsed time and any unmet objective. Keep the operations guide evergreen.
