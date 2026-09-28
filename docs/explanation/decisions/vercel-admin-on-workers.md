# Vercel apps keep admin on Workers

Decided 2026-09-28.

## Decision

An app hosted on Vercel has its admin in a separate Cloudflare Worker, `apps/admin`, on
`admin.<domain>`, behind Access. It reads and writes the app's Neon database through Hyperdrive.

## Why

Cloudflare Access protects hostnames Cloudflare proxies. Vercel does not support a Cloudflare proxy
in front of a deployment, because it hides traffic from Vercel's firewall and bot protection and
adds latency ([Vercel's guidance](https://vercel.com/guides/cloudflare-with-vercel)). A separate
Worker keeps admin behind the same Access application, the same in-Worker check, and the same audit
table as every Cloudflare app.

## Rejected

- **Admin routes inside the Vercel app, gated by a better-auth admin role.** It would be a second
  sign-in and authorization system to build, review, and keep current, with its own sessions and
  recovery.
- **Proxying the Vercel app through Cloudflare.** Vercel does not support it.
- **Vercel's deployment protection.** It protects whole deployments, not a path, and it is not the
  identity system the other admins use.
