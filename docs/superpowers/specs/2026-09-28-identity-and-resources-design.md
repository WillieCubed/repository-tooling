# Proposal: identity, linking, and resource standards for personal web projects

A draft for Willie's review, 2026-09-28. It adds to the standard in `WillieCubed/repository-tooling`
and restates none of it. Evidence is in the survey (kept outside the repository); decisions only
Willie can make are in the decisions at the end of this record.

## The idea

Every web project Willie makes is a publication, and willie.page is its publisher. A book carries
its publisher's name on the spine and the title page: small, in the same place in every book, and
never part of the story. Each project does the same. It carries one small link to willie.page in the
page's chrome, and the work itself (a deck, a cover, a slide, an app screen) stays free.

That splits identity into two layers. The constant layer is the mark, the link, and the link's
machine-readable twin; a project installs it and does not edit it. The free layer is type, color,
layout, and voice; the project owns it outright. The reports framework already works this way: the
identity line never changes, and every report breaks from everything else. This proposal applies the
same split to every project.

Projects stay independent. Each installs the constant layer as a pinned package and declares
everything else in its own source. willie.page links back by editing its own content. Nothing lists
every project, and no project reads another's settings. Projects already share some things without
saying so: one Cloudflare account's daily quotas, one zone's single free rate-limit rule, and names
that must be unique in the account. Sections 3 and 4 name each one and give it a rule, because
independence breaks there today.

Today willie.page publishes a complete identity, but of the three live project sites on its
subdomains only party.willie.page links back, in one sentence without `rel="author"`. The mark and
willie.page's colors have each been hand-copied into two projects.

## 1. The author link

### The element

**Rule.** Every web project shows, on every page a visitor reaches without an admin sign-in, one
link to `https://willie.page/` whose text is Willie's name and whose `rel` includes `author`.

It has two forms:

- **Lockup form**, the default: the kit's tiled mark followed by "Willie Chalmers III". It is the
  kit's own "Willie Chalmers III" lockup, set small.
- **Prose form**: his name linked inside the project's own sentence, as WPP's landing page does with
  "Hey, it's [Willie]." (`wpp/src/lib/landing.ts`). It counts on that page once the link carries
  `rel="author"`; today it has no `rel`.

The text is the name, because a guest's question is who made this. It matches willie.page's own
`og:site_name`. "Made with ❤️", "Powered by", and a bare "willie.page ↗" are out. The wording is
open question 4.

### Placement by page type

| Page type                | Examples                                             | Placement                                                                                                                               |
| ------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Site page                | party.willie.page `/`, superbloom.willie.page        | Last line of the page footer, start-aligned                                                                                             |
| Guest page               | WPP `/rsvp/<party>`, `/r/<token>`                    | Page footer                                                                                                                             |
| Deck viewed by one guest | WPP `/<party>`                                       | Below the presentation frame, never on a slide                                                                                          |
| App                      | nerve home, sign-in, account                         | Footer of those pages; never in a focus mode such as nerve's `/s/<id>/rehearse`                                                         |
| Audience screen          | WPP `/admin/<party>/screen`, putin `/` and `/d/<id>` | The control corner, beside fullscreen, revealed with the other controls                                                                 |
| Report                   | reports shelf and `/<year>/<period>`                 | Shelf: end of the masthead row. Report page: the nav row beside "All reports". Never on a cover                                         |
| 404                      | Every project                                        | Where the project's other pages put it. For a project whose other pages are all audience screens, this is where a lost visitor finds it |
| Admin                    | WPP `/admin/*`                                       | Not required; the reader is Willie or a named person                                                                                    |

On an audience screen the link stays in the DOM. It shows when the pointer moves or it takes
keyboard focus, and hides after 3 seconds of stillness, the way WPP's fullscreen control already
behaves (`wpp/README.md`, "Waiting screen"). It opens in a new tab so the screen keeps running. A
click-anywhere-to-advance handler, like putin's, ignores clicks that land on a link.

### Appearance

Derived from willie.page's kit (`website/app/brand/page.tsx`, `website/public/brand/`):

- **Mark:** the kit's tiled mark, the geometry of `public/brand/web/favicon.svg`: a `#2f6f5e` tile
  with facets `#f4f5ef`, `#8fd1b8`, and `#1c231e`, at 1.25em and never under 16 px. The kit says
  "Use the tiled mark below 32px". The tile carries its own ground, so one file reads on WPP's
  `#efe8dc` paper, putin's `#111413` room screen, and any report's ground without recoloring.
- **Name:** in the host page's font and ink (`font: inherit; color: currentColor`), weight 600, at
  the host's small text size and never under 14 px. No page loads Atkinson Hyperlegible for one
  line.
- **Spacing and target:** 0.5em between tile and name; a hit area of at least 24 by 24 CSS px (WCAG
  2.2 SC 2.5.8).
- **States:** a 2 px underline at 4 px offset on hover, as reports' links already have; a 2 px
  `currentColor` focus ring at 4 px offset, as willie.page's footer uses. No color change and no
  motion. The spinning, recoloring cube stays willie.page's own, as the kit reserves it.

### Machine-readable identity

- `<link rel="author" href="https://willie.page/">` in every page's head. willie.page emits this
  exact tag for itself (`website/app/layout.tsx`), so both sides name the same URL.
- The visible link is `<a class="h-card" rel="author" href="https://willie.page/">`. HTML reads an
  `a` with `rel="author"` as naming the author of its nearest `article` ancestor, so the link sits
  outside any `article` (HTML Standard, link type "author"). The `h-card` class makes it a minimal
  h-card. A parser that follows it reaches willie.page's representative h-card, whose `url` and
  `uid` equal `https://willie.page/` (`website/components/home/Rail.tsx`), as the IndieWeb
  authorship algorithm expects.
- On a public, indexed home page only: JSON-LD `WebSite` with `name`, `url`, and `author` set to
  `{"@type": "Person", "@id": "https://willie.page/#person", "name": "Willie Chalmers III", "url": "https://willie.page/"}`.
  The `@id` is the one willie.page's graph uses (`website/lib/seo/jsonld.ts`). Unlisted sites such
  as putin and reports skip it, since it serves only search engines.
- `og:site_name` is the project's own name, such as "Willie's PowerPoint Party". "Willie Chalmers
  III" belongs to willie.page (`website/docs/metadata.md`).
- Never `rel="me"`. It asserts that a page is also Willie, and it stays reserved for the four
  profiles in willie.page's footer. A party site is Willie's work, not Willie.
- No query parameters. The referrer names the project where the page's policy allows it.

The reverse link matters too. The GitHub profile that willie.page marks `rel="me"` lists
`https://williecubed.me` as its website, a domain that no longer resolves (section 3). Each
`rel="me"` profile should point back at `https://willie.page/`.

### Delivery: `@williecubed/brand`

**Rule.** Projects get the mark, the author link, and willie.page's tokens from one pinned package,
`@williecubed/brand`, and never copy them.

**Problem.** Copying is how it works today, and the copies drift.
`wpp/src/components/CubeMark.astro` copies the kit "verbatim".
`reports/apps/site/src/components/CubeMark.astro` copies it "by way of wpp" and has grown a `tone`
prop that WPP's lacks. `putin/src/pages/index.astro` and `reports/apps/site/src/styles/global.css`
copy willie.page's color roles as hex values.

**Contents.**

- `AuthorLink.astro` and `AuthorLink.tsx`, with an `audience` option for the reveal behavior.
- `authorLinkHtml`, a string for pages generated outside a framework, such as WPP's service-worker
  offline page (`src/lib/pwa/offline-page.ts` on `origin/main`).
- `AuthorHead.astro` and `authorHead()` for Next.js metadata: the head link and the home-page
  JSON-LD.
- `CubeMark.astro` and `CubeMark.tsx` with the kit's variants.
- `tokens.css` with both color schemes.

It has no runtime dependencies. A kit change reaches each project as an update pull request that the
project merges when it chooses.

Loading the mark from willie.page at runtime is rejected. reports' CSP allows `img-src 'self' data:`
only (`reports/apps/site/public/_headers`), and a willie.page outage would break every project.
Where the package is published from is open question 2.

**Applies to** every web app. It does not apply to CLIs, native apps, or admin-only Workers.

### Verification

**Rule.** A build fails when a page lacks the author link, and production is checked for it too.

- `cube check pages <dir>` reads every built `.html` file under an app's output directory. It fails
  when a page lacks the head `link`, or a visible `a[rel~="author"][href="https://willie.page/"]`
  that has text and sits outside any `article`. It runs as the app's `validate` script, which the
  app's `turbo.json` makes depend on its own `build`. It skips willie.page, since that site is the
  target.
- `pnpm preflight --production` fetches the production home page and a missing path and applies the
  same test. That covers on-demand pages, such as WPP's decks and putin's `/d/<id>`, and whatever is
  actually deployed.
- The templates put `AuthorLink` and `AuthorHead` in their `Base` layout, so a new project passes on
  its first commit. No exemption mechanism ships, because no current page needs one.

### Links from willie.page back

**Rule.** willie.page lists a project by adding an entry to its own content, and only projects meant
to be found. No project reads that list, and nothing collects it automatically.

**Problem.** The means exist and are stale. `content/initiatives/superbloom/index.mdx` links to
superbloom.willie.page, which does not link back. `/projects` is parked (`routed: false` in
`website/lib/site.ts`), `data/projects.json` lists URLs that no longer resolve, and
`docs/projects.md` still prescribes `<project>.williecubed.me` hostnames.

**Applied by** review, when `/projects` is rebuilt from `content/projects/*.mdx`. Unlisted projects
are never listed: reports (its `AGENTS.md` forbids it), putin, and WPP's decks. WPP's landing page
may be. Whether the index lives on willie.page or williecubed.dev is open question 7.

## 2. Visual identity

### The constant layer

| Element     | Rule                                                                                                                                                                                                                                               | Evidence                                                                                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mark        | From `@williecubed/brand` only, under the kit's rules: no recoloring, rotating, stretching, or effects; the tiled mark below 32 px                                                                                                                 | Two hand copies. reports draws the bare cube at `8cqw` on shelf covers, about 13 px on a 390 px phone (open question 8)                                                                                             |
| Author link | Section 1                                                                                                                                                                                                                                          |                                                                                                                                                                                                                     |
| Name        | "Willie Chalmers III" in the link and in structured data. "Willie" is fine in a project's name and first-person copy, as in "Willie's PowerPoint Party" and "Willie's reports"                                                                     | willie.page `og:site_name`; the kit's lockup                                                                                                                                                                        |
| Head floor  | Every page: title, description, canonical URL or `noindex`, `favicon.svg`, the author head link. Every page whose link is sent to people, even when `noindex`: `og:title`, `og:site_name`, and a 1200×630 `og:image`. `cube check pages` checks it | putin has no `og` tags though its links are shared at parties. reports has none though every report link goes out in a letter. nerve has no favicon. WPP's live canonical is `https://party.willie.page/index.html` |

### The free layer

A project chooses its own type, palette, layout, favicon art, social image, 404 voice, motion, and
dark mode. The survey shows this working: WPP's `#efe8dc` paper and `#a8321e` oxide in IBM Plex Sans
and Fraunces, putin's per-deck themes, each report's cover. No shared social-image template is
proposed; each card is part of its project's design.

- **Borrowing willie.page's look.** A project imports `@williecubed/brand/tokens.css` instead of
  copying hex values.
- **Favicon.** A project with no mark of its own uses the kit's tile, as reports does. An
  installable site, or one opened mostly from phone messages, also ships a 180×180
  `apple-touch-icon.png` and a manifest, as WPP's `origin/main` does.
- **404 page.** The page answers 404, is `noindex`, says in plain words that nothing is at this
  address, links to the project's front page, and carries the author link. Voice is free: putin's
  "This slide isn't in the deck." is right for putin. nerve has no custom 404 page.
- **Subdomain.** The subdomain is the word people say, not the repository name: `party`, not `wpp`.

### Deliberate departures

A project departs from the free layer without asking. The constant layer gives way only inside the
work itself: a report cover, a slide, a deck frame. There, a project shows the reports identity line
or nothing. The chrome around the work (nav, footer, shelf, control corner) keeps the constant
layer. This generalizes the reports framework's own sentence: "The shelf, the identity line and the
page around a cover wear the willie.page brand."

## 3. Infrastructure conventions

### Domains that identity depends on

**Rule.** Every domain that a project, profile, or email address uses stays registered at Cloudflare
Registrar with auto-renew. A domain is retired only after every reference to it is gone.

**Problem.** `williecubed.me` has no NS records, and `whois.nic.me` answers "Domain not found". It
is still the global git `user.email` on recent commits in website, wpp, putin, and reports. It is
also the GitHub profile's public email and website, a 308 source in `website/lib/site.ts`, and a URL
in `website/data/projects.json`. Whoever registers it receives mail for `willie@williecubed.me`, a
password-reset route for any account that uses the address. They also serve whatever they like at
the URL his GitHub profile advertises.

**Applied by** a one-time fix (open question 1), then review. **Applies to** the account and every
project.

### Names unique in the account

**Rule.** Every name that must be unique in the Cloudflare account starts with the project's Worker
name. That covers D1 databases, KV namespaces, R2 buckets, queues, Access applications and policies,
Turnstile widgets, and zone rule names. A rate-limit binding's `namespace_id` is derived, never
picked: the first 31 bits of SHA-256 of `<worker>/<binding>`, in decimal.

**Problem.** Every personal Worker shares one account, and `pnpm bootstrap --production` adopts an
existing resource by name. WPP's KV namespace is `party-session` while its Worker is `wpp`. WPP's
`RSVP_LIMIT` uses `namespace_id = "1"` and putin's `GENERATE_LIMIT` uses `"2"`, both chosen by hand.
Bindings with the same `namespace_id` share counters across Workers in an account (Cloudflare's rate
limit docs). A third project that picks `"1"` would share WPP's per-IP counts on party night.

**Applied by** `cube check platform` and the templates' wrangler configs. **Applies to** Cloudflare
apps.

### No workers.dev copy

**Rule.** A Worker with a custom-domain route sets `workers_dev: false`. It sets
`preview_urls: false` unless the project uses previews.

**Problem.** `workers_dev` defaults to `true`. The workers.dev hostname sits outside the willie.page
zone, so Bot Fight Mode and zone rules do not apply there, and it is a second indexable copy of the
site. WPP, putin, and reports turn it off by hand ("A private holding page should not also resolve
at wpp.<account>.workers.dev", `wpp/wrangler.toml`). The template
`examples/with-astro/apps/site/wrangler.jsonc` does not.

**Applied by** the template and `cube check platform`.

### Zone-wide settings

**Rule.** A project on a shared zone declares no zone-wide setting as its own. Per-client limits
live in the Worker's rate-limit binding. Bot Fight Mode and the zone's rate-limit rules are settings
of the zone, recorded in `website/docs/deploy.md`, which already owns willie.page's DNS.

**Problem.** The Free plan allows one rate-limiting rule per zone, with a 10 s period and a 10 s
block. WPP's "Throttle RSVP writes" holds willie.page's one rule, yet the manifest's `zoneRules`
lets every app declare its own. Bot Fight Mode, turned on for WPP, also covers putin, reports, and
superbloom.

**Applied by** documentation in the platform manifest reference; the choice is open question 5.

### Indexing unlisted sites

**Rule.** A site is public, unlisted, or private.

- **Public:** indexed and in the sitemap.
- **Unlisted:** every response sends `X-Robots-Tag: noindex`, and `robots.txt` allows crawling of
  those pages. A crawler blocked by `robots.txt` never sees the `noindex` and can still list the URL
  (Google Search Central). `Disallow` stays only on paths where a crawl costs a Worker invocation,
  such as WPP's `/rsvp/`, `/r/`, and `/admin`.
- **Private:** behind Access.

**Problem.** `putin/public/robots.txt` and `reports/apps/site/public/robots.txt` disallow everything
while also sending `noindex`, and their pages are static assets, which are free to serve. A
`Disallow: /` also stops any link-preview bot that honors `robots.txt`, and a report link pasted
into a message depends on its preview. `reports/AGENTS.md` makes `Disallow` a rule, so this reverses
it (open question 6).

**Applied by** two `robots.txt` variants in the templates, plus review.

### Signed in to the right account

**Rule.** Preflight's Cloudflare check passes only when the signed-in session can read the account
named in the wrangler config.

**Problem.** On this machine `wrangler whoami` succeeds while signed in to the LVBT account.
`wrangler d1 list` in wpp then fails with authentication error 10000. Preflight runs only `whoami`.

**Applied by** `cube preflight`.

## 4. Resource usage

### Cloud limits the projects rely on

| Resource              | Free limit                                                                                                      | At the limit                                   | Used by                |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------- |
| Worker requests       | 100,000 per day per account                                                                                     | Error 1027, or 429 on `run_worker_first` paths | wpp, putin, superbloom |
| Workers AI            | 10,000 neurons per day per account, reset 00:00 UTC (5 p.m. PDT)                                                | Calls fail                                     | putin                  |
| D1                    | 5 million rows read, 100,000 written per day                                                                    | Queries fail until reset                       | wpp                    |
| KV                    | 1,000 writes per day                                                                                            | Writes fail                                    | wpp (bound, unused)    |
| Cron triggers         | 5 per account                                                                                                   | No sixth trigger                               | wpp (1)                |
| Zone rate-limit rules | 1 per zone                                                                                                      | Cannot add                                     | wpp                    |
| Vercel Hobby          | 1 million invocations, 4 CPU-hours, 100 GB transfer per month; 100 deployments per day; non-commercial use only | The feature pauses for up to 30 days           | website                |

Sources for each figure are listed at the end of the survey (kept outside the repository). Workers
Paid costs $5 a month minimum, with 10 million requests included. Every Cloudflare row is shared by
all personal projects, which is why the plan is open question 3.

**Rule: a `Limits` section.** Each deployed app's `operations.md` gets a `Limits` section. It lists
every metered resource the app uses, the plan's limit with a link, the app's expected peak with the
arithmetic, and what a visitor sees at the limit. `cube check documents` requires the section.

**Problem.** The only recorded budget is in putin's README, and it covers the older `/deal` mode.
The one-word mode on the TV makes two calls per round with `max_tokens` 700 and 250, each tried
twice (`putin/src/pages/words.ts`). Output alone can reach 1,900 tokens, or 389 neurons at 204,805
neurons per million output tokens. The free day therefore covers at most about 25 worst-case rounds
before input tokens. After that `/words` answers 503 and the title slide stays up. Nobody has
measured a real round.

**Rule: guarded paid endpoints.** A public endpoint that spends money or a shared daily pool has
three guards: a per-client limit, a daily ceiling below the pool, and a designed state at the
ceiling. putin's `/deal` has that state: it falls back to the hand-written bank.

**Problem.** Three nerve routes call `claude-sonnet-4-6` with no session and no limit:
`api/coach/route.ts` and `api/rehearse/feedback/route.ts` (`max_tokens` 3,000) and
`api/situations/stage/route.ts` (500). One script can spend to the organization's monthly cap.

**Applied by** review, with the write guard the standard already has on Workers. On Vercel, the
limit keys on the better-auth session nerve already creates.

**Rule: a cap at each provider.** Each paid provider caps each project at the provider:

- **Anthropic:** one workspace per project, with its own monthly spend limit (Anthropic's rate limit
  docs).
- **Vercel:** a paid app sits on a Pro team with Spend Management and "Pause Production Deployments"
  on.
- **Cloudflare, if on Paid:** an account budget alert. It only notifies and can only be set in the
  dashboard, so it is recorded like the account itself.

**Problem.** nerve takes payments through Stripe, which Vercel treats as commercial use and forbids
on Hobby. Its launch checklist (`nerve/docs/18-deploy-and-launch.md`) has no plan or spend step.

**Rule: no Vercel builds for agent branches.** Vercel projects set `git.deploymentEnabled` to
`false` for `claude/**` and `codex/**`.

**Problem.** Hobby allows 100 deployments a day and one build at a time. `website/vercel.json`
covers `claude/**` only, and agents push `codex/*` branches too, as WPP's remote shows.

### Local disk

On 2026-09-28, after the day's cleanup, the data volume had 27 GiB free of 926 GiB. The shared Cargo
target and pnpm clone linking are already rules; the space below is not covered by any.

**Rule: clean worktrees by what git knows.** A weekly job walks `git worktree list` for every
repository under `~/Projects`. It runs `git worktree remove`, without `--force`, on a worktree whose
branch is merged into the default branch or deleted on the remote, or which is clean and untouched
for 14 days. A dirty one is reported, not removed.

**Problem.** Worktrees live in four places: `<repo>/.claude/worktrees`, `<repo>/.worktrees`
(lovelace: 62 GiB), `~/.codex/worktrees` (45 entries, 39 GiB, the oldest from 2026-07-31), and
`~/CelloWork/worktrees`. disk-janitor removes only `*/.claude/worktrees/agent-*` under `~/Projects`
(`disk-janitor/bin/disk-janitor`, line 364), and 24 of the 26 Claude worktrees found do not match
that pattern.

**Rule: emulators and simulators.** A weekly job reports AVDs untouched for 30 days and system
images no AVD uses, and runs `xcrun simctl delete unavailable`. AVDs are reported rather than
deleted, because they can hold app state.

**Problem.** Six AVDs hold 43 GiB, among them `Stylus_Tablet_v2` at 13 GiB, last modified
2026-03-26. System images hold 30 GiB and 52 simulators 17 GiB. Gradle managed devices, declared in
five logdate-mobile benchmark modules, create AVDs of their own; they filled the disk earlier today.

**Rule: a Docker ceiling.** Docker Desktop's disk usage limit is 64 GiB. The current `Docker.raw` is
sparse, with a 256 GiB maximum and 13 GiB allocated.

**Rule: preflight warns on low disk.** `cube preflight` warns under 50 GiB free and fails under 15
GiB, printing `disk-janitor run --dry-run` as the fix.

**Problem.** One website worktree with dependencies takes 1.3 to 2.0 GiB, and a full disk makes
builds fail with errors that do not mention space.

**Applied by** disk-janitor for the first three rules and the CLI for the fourth. **Applies to**
Willie's machines, not to project source.

## 5. Also missing

**Rule: a privacy page.** An app with accounts or payments publishes `/privacy`, written from the
`data-inventory.md` the standard already requires, so the two agree.

**Problem.** nerve stores accounts, talks, and Stripe customers, and its launch checklist says
"Privacy/terms copy reviewed", but `apps/web/app` has no such route.

The survey found no evidence for new accessibility or performance rules. The templates already run
axe in their browser tests.

## Order of work

1. `williecubed.me`, the git email, and the GitHub profile, this week.
2. `@williecubed/brand` and `cube check pages`, adopted in reports before its first deploy, then in
   WPP, putin, and superbloom.
3. Template changes: `workers_dev`, name prefixes, derived `namespace_id`, `robots.txt`, `Limits`.
4. nerve before launch: route limits, Spend Management, an Anthropic workspace, `/privacy`.
5. disk-janitor and the preflight disk check.

## Decisions (2026-09-28)

Willie accepted every recommendation in the open questions:

1. williecubed.me: re-register it (Willie registers it later); move git and GitHub emails to
   willie.page addresses.
2. `@williecubed/brand` is published from the website repository.
3. The personal Cloudflare account moves to Workers Paid with a budget alert.
4. The author link reads "Willie Chalmers III" beside the tiled mark; the prose form is allowed.
5. Zone-wide settings belong to the zone, recorded in the website repository.
6. Unlisted sites allow crawling and send `X-Robots-Tag: noindex`.
7. willie.page `/projects` is the projects index; williecubed.dev redirects there until built.
8. The kit gains a small-size bare cube for the reports identity line under 32 px.
