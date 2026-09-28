# Why admin sits behind two checks

Every admin surface in a personal project is protected twice: Cloudflare Access at the edge, and the
Worker verifying Access's signed token itself before any admin route runs. This page explains each
choice. The rules themselves are in the [admin reference](../reference/admin.md).

## Access instead of application sign-in

Admin users are the owner and, occasionally, a few named people. Building sign-in for them inside
each app would mean sessions, recovery, and multi-factor authentication in every repository. Access
moves all of that to one place: people sign in with an identity provider that already enforces
multi-factor authentication, and the app receives a signed statement of who they are.

Each app's manifest lists who may sign in to its admin, and setup gives the app its own Access
policy with exactly those addresses. Apps do not share a policy, so changing who can administer one
project never changes another, and each project's source is enough to rebuild its access rules.

## The Worker checks again

Access fails open. If an application is deleted, renamed, or given the wrong path, requests reach
the Worker with no sign-in at all, and nothing in the app notices. So the Worker verifies the
`Cf-Access-Jwt-Assertion` header on every admin request: the RS256 signature against the team's
published keys, then the audience, issuer, and expiry. Signature first, because claims read from an
unverified token are attacker input.

The check runs in middleware, before routing, for every path under the admin prefix. A new admin
page is private without anyone remembering to make it so. Checks inside individual pages are not
allowed, because the one page that forgets is the one that leaks.

## Failing closed

When the Access settings are missing, admin answers 503 and does not serve the page. In WPP, an
earlier development bypass was keyed on an empty audience value, and `/admin` was public for one
deploy because production also had an empty value. The bypass now needs an explicit
`ADMIN_DEV_OPEN=1` in the gitignored `.dev.vars` file, a value production never has.

## Knowing who did what

The verified identity is kept. It travels to the route, and every admin change writes an audit row
naming the person, the action, the target, and the time. Without it, a changed record cannot be
traced to a person, and a leaked session cannot be scoped.

## Vercel apps

Access protects only hostnames that Cloudflare proxies, and Vercel does not support being proxied.
So a Vercel app's admin is a separate Worker on `admin.<domain>`, which gets the same two checks.
One security model, not two, is the reason: an in-app admin role on Vercel would be a second sign-in
system to review and keep current.

## Public write paths

Pages without sign-in that accept writes, such as a form or a generation request, check requests in
order of cost: body size before reading the body, then content type, then the rate limit, then the
database. Astro's origin check guards form encodings only and skips `application/json`, so the write
guard rejects cross-site JSON itself. Admin posts go through the same guard.

Webhooks from third parties cannot pass Access, so they live outside the admin prefix and verify
their own signatures, answering 404 to anything that does not verify.

## Secrets

Secret values go to Wrangler and `gh` on standard input and are never printed. Prerendered code
never reads a secret, because the value would be built into the shipped HTML. Deploy tokens have the
fewest permissions that deploy works with, scoped to one account and one zone.
