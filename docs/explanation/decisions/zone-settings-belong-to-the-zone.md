# Zone-wide settings belong to the zone

Decided 2026-09-28.

## Decision

A project on a shared zone declares no zone-wide setting. Bot Fight Mode and the zone's rate-limit
rules for `willie.page` are recorded in the website repository's `docs/deploy.md`, which already
owns the zone's DNS. Per-client limits live in each Worker's rate-limit binding. A project's
`platform.json` uses `zoneRules` only for a zone of its own.

## Why

The Free plan allows one rate-limiting rule per zone, and WPP's "Throttle RSVP writes" holds
`willie.page`'s one rule. Bot Fight Mode, turned on for WPP, covers every project on the zone. A
setting that affects every project cannot belong to any one of them without coupling the others to
it.

## Rejected

- **Upgrading the zone to Pro** for two rules. It doubles a scarce resource and leaves it first
  come, first served.
- **One combined rule listing every project's paths.** Every project would then edit a shared rule.
- **Giving each project that wants zone rules its own domain.** It remains available to a project
  that truly needs zone protection of its own.
