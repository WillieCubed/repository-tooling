# Admin

The contract every admin surface meets. The reasoning is in
[Why admin sits behind two checks](../explanation/security-model.md).

These are application requirements, not a claim that runtime middleware is installed. The proposed
`@williecubed/access`, `@williecubed/edge-security` and `@williecubed/audit` packages are not
implemented in this repository. Reuse a verified implementation from the product or shared Studio
tooling where it fits, and exercise its actual authorization boundary before exposing admin.

## Location

| App host           | Admin lives at                                   |
| ------------------ | ------------------------------------------------ |
| Cloudflare Workers | `/admin` and `/admin/*` on the app's own host    |
| Vercel             | An `apps/admin` Worker on `admin.<domain>`, `/*` |

A Vercel app's admin Worker reads and writes the app's Neon database through Hyperdrive. It never
calls the Vercel app's API to change data, so one admin action is one database transaction.

## Edge

`platform.json` declares one Access application per admin surface:

- destinations list both the prefix and the prefix with `/*`, because a path does not cover the
  paths under it and a wildcard does not cover its parent;
- the allow rule is the application's own policy, `<name> allow`, listing the addresses in
  `allow.emails`;
- sign-in uses one identity provider, one-time PIN unless the manifest names Google, with instant
  authentication;
- sessions last 24 hours, with the binding cookie on.

`pnpm bootstrap --production` creates it and stores the audience tag as `ACCESS_AUD`.
`pnpm preflight --production` fails when the application protects fewer paths than declared or has a
policy that admits everyone.

## Gate

Application middleware verifies the Access identity for every request under the admin prefix, before
routing. Reuse the product's approved JWT implementation instead of writing a second verifier merely
to satisfy a proposed package name.

| Result                                     | Response                         |
| ------------------------------------------ | -------------------------------- |
| `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` unset | 503, admin not configured        |
| Header missing or token invalid            | 403, with the reason in the body |
| Token valid                                | The identity, passed to routes   |
| `ADMIN_DEV_OPEN=1` in `.dev.vars`          | A fixed local identity           |

The gate accepts RS256 only, verifies the signature before trusting claims, and then checks that
`aud` includes `ACCESS_AUD`, that `iss` is the team URL, and `exp` and `nbf` with 60 seconds of
clock skew. Keys come from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, are cached,
and are refetched when a token names an unknown key id, at most once a minute.

The local development bypass must be unavailable outside an explicitly local environment. Staging
and production use separate credential stores, audiences and permitted hosts, and reject each
other's credentials. Missing or malformed configuration keeps admin closed. Owner administration
does not require adding customer accounts or a public signup flow.

## Routes

- Admin pages render on demand. None is prerendered, and every admin path is listed in the Worker's
  `run_worker_first`, because the asset layer serves prerendered files before the Worker runs.
- Every change is a `POST` answered with `303 See Other`. A `GET` changes nothing. The one allowed
  exception is an OAuth callback, which does nothing without a `state` value the app signed.
- Posts pass the framework's supported origin/CSRF checks and the application's size, content-type,
  authorization and rate-limit guards. Public write paths retain their own appropriate protections.

## Headers

Every admin response carries `Cache-Control: no-store`, `X-Robots-Tag: noindex`,
`Referrer-Policy: same-origin`, and the shared content security policy, applied in one place by
`applyPrivateHeaders`. `no-referrer` is not used: under it, Chrome sends `Origin: null` on a native
form post and the origin check rejects it.

## Audit

The application owns durable audit storage and its migration. A minimal record includes:

| Column        | Contents                                           |
| ------------- | -------------------------------------------------- |
| `id`          | Row id                                             |
| `at`          | ISO 8601 time, written by the app                  |
| `actor_email` | The verified Access identity                       |
| `action`      | A dotted verb from the app's list, such as `x.set` |
| `target`      | The record the action changed                      |
| `request_id`  | Cloudflare's `cf-ray` value for the request        |

Every admin route that changes data records the verified actor and change atomically. The ordinary
application cannot silently rewrite audit history. Define retention and deletion obligations,
authorized maintenance, and recovery behavior alongside the data inventory. The application's admin
guide lists the actual actions and storage implementation.

## Webhooks

A webhook endpoint lives outside the admin prefix, because the third party cannot sign in to Access.
It verifies the sender's signature or a token the app signed, and answers 404 to anything that does
not verify, so a scan learns nothing.

## Previews

A preview deployment of an app with admin either has its own Access application or keeps admin
closed. A preview-only key that opens admin is allowed only when `platform.json` lists it under
`forbidden` for production, so production can never carry it.

## Checklist for a new admin page

1. Put it under the admin prefix, rendered on demand.
2. Make every change a `POST` that ends in a `303`.
3. Record an atomic audit event for every change, and list the action in the app's admin document.
4. Add a test that the page answers 403 without a token.
