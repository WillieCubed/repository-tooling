# Infrastructure conventions

Rules for things personal projects share without saying so: domains, names in one Cloudflare
account, zones, and search indexing. Each rule keeps one project from quietly affecting another.

## Domains

Every domain that a project, a profile, or an email address uses stays registered at Cloudflare
Registrar with auto-renew. A domain is retired only after every reference to it is gone: git
configuration, profiles, redirects, and content. A lapsed domain that still receives mail is a
password-reset route for anyone who registers it.

## Names unique in the account

Every name that must be unique in the Cloudflare account starts with the project's Worker name: D1
databases, KV namespaces, R2 buckets, queues, Access applications and policies, Turnstile widgets,
and zone rule names. `pnpm bootstrap --production` adopts an existing resource by name, so two
projects with the same name would share one resource.

A rate-limit binding's `namespace_id` is derived, never picked: the first 31 bits of the SHA-256 of
`<worker>/<binding>`, written in decimal. Bindings with the same `namespace_id` share counters
across every Worker in the account
([rate limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)).

`cube check platform` enforces both.

## No `workers.dev` copy

A Worker with a custom-domain route sets `workers_dev: false`, and sets `preview_urls: false` unless
the project uses previews. The `workers.dev` hostname sits outside the project's zone, so zone
protection does not apply there, and it is a second indexable copy of the site. The templates and
`cube check platform` enforce it.

## Zone-wide settings

A project on a shared zone, such as `willie.page`, declares no zone-wide setting. Per-client limits
live in the Worker's rate-limit binding. Bot Fight Mode and the zone's rate-limit rules belong to
the zone and are recorded in the website repository's `docs/deploy.md`, which owns willie.page's
DNS. A project's `platform.json` uses `zoneRules` only for a zone of its own. The reasoning is in
[Zone-wide settings belong to the zone](../explanation/decisions/zone-settings-belong-to-the-zone.md).

## Indexing

Every site is public, unlisted, or private.

| Kind     | Rule                                                                                          |
| -------- | --------------------------------------------------------------------------------------------- |
| Public   | Indexed, and listed in its sitemap                                                            |
| Unlisted | Every response sends `X-Robots-Tag: noindex`, and `robots.txt` allows crawling of those pages |
| Private  | Behind Access                                                                                 |

An unlisted site allows crawling because a crawler blocked by `robots.txt` never sees the `noindex`
and can still list the URL
([Google Search Central](https://developers.google.com/search/docs/crawling-indexing/block-indexing)),
and because link-preview bots that honor `robots.txt` show nothing for a blocked page. `Disallow`
stays only on paths where a crawl costs a Worker invocation, such as write paths and `/admin`. The
templates ship one `robots.txt` for each kind.

## Signed in to the right account

`pnpm preflight` passes its Cloudflare check only when the signed-in session can read the account
named in the wrangler config. A session signed in to another account passes `wrangler whoami` and
then fails on the first resource.
