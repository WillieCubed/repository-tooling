# Where a project runs

Cloudflare Workers is the default host for every personal project. Vercel hosts an app only when a
feature that app ships cannot run well anywhere else. The decision is made per app, so one
repository can hold a Vercel app and the Cloudflare Worker that administers it.

## The default: Cloudflare Workers

An app is one Worker with static assets. Pages is not used; Workers static assets replaced it, and
one deploy model is easier to keep secure than two.

| Need                                       | Cloudflare product                                           |
| ------------------------------------------ | ------------------------------------------------------------ |
| A content site, with MDX where it helps    | Astro on Workers static assets                               |
| An interactive application                 | Vite and React on Workers static assets                      |
| An API with no pages                       | Hono on a Worker                                             |
| Relational records                         | D1                                                           |
| Uploaded or generated files                | R2                                                           |
| Cached values and small config             | KV                                                           |
| Coordination, realtime, per-entity state   | Durable Objects                                              |
| Work after the response, retries, schedule | Queues, Workflows, and cron triggers                         |
| Model calls                                | Workers AI, or AI Gateway to a provider                      |
| Proving a form was sent by a person        | Turnstile                                                    |
| Transactional email                        | Resend, until the manifest supports Cloudflare Email Service |
| Throttling a write path                    | A rate-limit binding, then a zone rule                       |
| Admin sign-in                              | Access, verified again inside the Worker                     |
| Page analytics without cookies             | Web Analytics                                                |

Everything in that table is declared in the app's `platform.json` and set up by
`pnpm bootstrap --production`. See the
[platform manifest reference](../reference/platform-manifest.md).

## When Vercel is the host

An app moves to Vercel when it ships a feature that needs one of these:

- Next.js rendering that depends on Vercel's runtime: React Server Components with incremental
  static regeneration, cache components, or partial prerendering.
- Vercel AI Gateway, Vercel Workflow, or Vercel Sandbox.
- Postgres, because the data model needs more than D1's SQLite. The database is a Neon project
  created through Neon's API, so a rebuild needs no Marketplace step.

Familiarity with Next.js is not on the list. A site that is mostly content stays on Astro and
Workers even when Next.js would also work.

The standard does not run Next.js on Workers through an adapter. An adapter between a framework and
a host has to track both, and the features that justify Next.js are the first ones an adapter lags.

## How a Vercel app is wired

- **DNS stays on Cloudflare, as DNS-only records.** Vercel does not support a Cloudflare proxy in
  front of a deployment: it hides traffic from Vercel's firewall and bot protection and adds latency
  ([Vercel's guidance](https://vercel.com/guides/cloudflare-with-vercel)). The record for the Vercel
  hostname is grey-clouded.
- **Admin is a sibling Worker.** Access protects hostnames that Cloudflare proxies, so it cannot sit
  in front of a Vercel deployment. The repository gets an `apps/admin` Worker on `admin.<domain>`,
  behind Access like every other admin, reaching Neon through Hyperdrive. The
  [admin reference](../reference/admin.md) covers both shapes.
- **Everything else is still Cloudflare** when the app can reach it: R2 for files, Turnstile for
  forms, and the same mail provider as the Workers apps.
- The Vercel project, its domains, and its environment variables are declared in the app's
  `platform.json` and created through Vercel's API, like every Cloudflare resource. Values are
  validated at build time like every other environment.

## Projects that are not hosted

Command-line tools and native apps (Rust, Python, Bash, Swift) have no host. They adopt the
repository hygiene half of the standard: `AGENTS.md`, the documentation layout, community-health
files, Renovate, gitleaks, and the ruleset. They do not adopt the web toolchain.

## Domains and accounts

A personal project lives on a subdomain of `willie.page` unless it has its own name. By default
every zone is in the personal Cloudflare account, and every admin signs in through its Access team,
`williecubed`. Each project's `platform.json` records the values it uses; the defaults templates
start from are in the [standard configuration](../reference/standard-config.md).
