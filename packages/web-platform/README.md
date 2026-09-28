# Web platform operations

`@williecubed/web-platform` provides the provider-neutral operations used to inspect and reconcile
the web infrastructure of WillieCubed repositories. Repository packages supply project discovery,
naming, routes, and lifecycle policy.

The package reads external state separately from reconciliation. Every resource describes its
current and desired values, then `reconcileResources` reports or applies the smallest necessary
change. `reconcileResourceGroups` preserves the same fail-closed planning boundary within ordered
dependency stages, such as repository creation before ruleset and environment configuration. Doctor
checks return structured results without mutating provider state.

Import GitHub operations from `@williecubed/web-platform/github`, Cloudflare operations from
`@williecubed/web-platform/cloudflare`, and the reconciliation contract from
`@williecubed/web-platform/provision`.
