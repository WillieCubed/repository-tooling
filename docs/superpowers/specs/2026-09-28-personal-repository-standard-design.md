# Personal repository standard (WillieCubed), modeled on LVBT

## Context

LVBT already has a working standardization system. `LasVegasForTransit/repository-tooling`
publishes:

- shared config packages,
- an `lvbt` CLI,
- template repos,
- a `platform.json` reconciler.

Each consumer vendors a hash-checked snapshot of it, and a daily self-update PR keeps that snapshot
current. The personal projects (WillieCubed) have nothing like this, and each repo has drifted in
its own direction:

- **Tooling:** WPP and putin use Astro, Workers and Biome; nerve and website use Next, Vercel and
  ESLint.
- **Docs:** some repos number their docs files, some use superpowers docs, some have none.
- **Hygiene:** no repo has a PR template, a dependency bot or a gitleaks check.

WPP has the best security design of the personal projects. It puts Cloudflare Access on `/admin`,
verifies the JWT in the Worker and fails closed. It also has gaps:

- Access and WAF rules were set up by hand.
- The admin's identity is thrown away after the check, so nothing is audited.
- There are no tests for Access.
- There is no retention or backup policy.
- The CSV export has no guard against formula injection.

**Goal:** one personal standard that covers:

- how repos are set up,
- how docs are written,
- when to host on Cloudflare vs Vercel,
- data handling,
- how admin works,
- security based on Cloudflare Access.

New projects start from a template and existing ones converge through vendored, self-updating
snapshots. LVBT is not touched.

## Decisions (settled)

| Topic                | Decision                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                | Personal (WillieCubed) repos only. LVBT keeps its own tooling.                                                                                                                                                                                                                                                                                                                                  |
| Mechanism            | Fork LVBT's `repository-tooling` into **`WillieCubed/repository-tooling`**. Move every hard-coded org value into one `standard.config.ts`: owner, npm scope `@williecubed`, CLI name `cube`, vendor dir `.williecubed/web-platform/`, CF account, Access team `williecubed`, zone `willie.page`. Promote this to a multi-venture engine only if a second venture needs it (prefer-local-scope). |
| Dependencies         | **One enforced pnpm `catalog:`**, the same in every repo (LVBT model). This **replaces** the old Nerve "no catalogs" rule. Pins stay exact, and versions change only through the CLI.                                                                                                                                                                                                           |
| Lint/format          | **ESLint + Prettier.** Fork LVBT's strict config and add `eslint-plugin-astro`, `eslint-plugin-mdx` and `prettier-plugin-astro`. TypeScript stays on **6.x** until typescript-eslint supports TS 7.1. Revisit Oxc when Oxlint can lint Astro templates.                                                                                                                                         |
| Admin on Vercel apps | A separate Cloudflare Worker (`apps/admin`) at `admin.<domain>`, behind Access, reaching the DB through Hyperdrive. Vercel doesn't support proxying through Cloudflare, so Access can't sit in front of Vercel directly.                                                                                                                                                                        |

## The standard itself (contents of `WillieCubed/repository-tooling`)

### 1. Hosting decision rule (goes in `docs/explanation/hosting.md`)

- **Default is Cloudflare Workers with static assets.** Frameworks: Astro (with MDX), Vite+React, or
  Hono.
  - Storage: D1 for relational data, R2 for files, KV for cache and config, Durable Objects for
    coordination and realtime.
  - Background work: Queues and Workflows.
  - Other services: Workers AI, Turnstile, email (Resend until the manifest supports Cloudflare
    Email Service), rate-limit bindings, and Access for admin.
- **Use Vercel only when the feature needs it.** That means a Next.js app that depends on
  RSC/ISR/cache components, the AI SDK with AI Gateway, Vercel Workflow or Sandbox, or Postgres
  (Neon, created through Neon's API so a rebuild needs no Marketplace step).
  - DNS stays on Cloudflare in **DNS-only (grey cloud)** mode.
  - Admin is always the sibling Worker described above.
- **Not hosted:** CLIs and native apps (Rust, Python, Bash). They get the hygiene preset only (see
  Rollout M4).

### 2. Repository setup (owned files: must match; seeded files: added once)

- A Turborepo with `apps/*` and `packages/*`, even for a single app.
- `packageManager` pins pnpm and `engines.node` requires Node 24.
- `pnpm-workspace.yaml` holds the catalog, `allowBuilds` and `minimumReleaseAge`.
- Every repo has the same root scripts: `bootstrap`, `preflight`, `dev`, `build`, `lint`,
  `check-types`, `test`, `test:e2e`, `format`, `check`, `deploy`, `standards:check` and
  `standards:update`. Repo-specific checks go in a Turbo `validate` task.
- **Owned** files:
  - `.githooks/*` (pre-commit: Prettier, the filename check and gitleaks; pre-push: `pnpm check`)
  - `.editorconfig`
  - `.github/actions/setup-node-pnpm`
  - `.claude/settings.json`, which denies reads of `.env*`, `.dev.vars*` and key files
- **Seeded** files:
  - `AGENTS.md`, starting with the standard header sections
  - **`CLAUDE.md` as a symlink to `AGENTS.md`**
  - `.lvbt`-style `commit-scopes.txt` placed under the vendor dir
  - `renovate.json`
  - `ci.yml`, which produces one `Validate` check: `pnpm check`, `pnpm audit`, gitleaks, and every
    action pinned to a commit SHA
  - `standard-update.yml`
- A **`WillieCubed/.github`** repo holds the community-health defaults: issue forms, and a PR
  template with `## TL;DR` / `## Changes` / `## Follow-ups and Next Work`.
- A per-repo ruleset: PRs required, `Validate` must pass, rebase merges only, linear history, no
  force-pushes.

### 3. Docs standard

- Use LVBT's layout: Diátaxis inside each domain, as
  `docs/<development|operations|product|security>/<tutorials|how-to|reference|explanation>/`.
- Also include a `docs/README.md` index and `docs/superpowers/{specs,plans}/`.
- Lint with markdownlint-cli2, with relative-link checking.
- Required documents, whose sections a check enforces:
  - `start-here`
  - `glossary`
  - `architecture` (arc42)
  - `operations` (Deploy / Roll back / Migrations / Restore / Incidents)
  - `secrets` (Inventory / Rotation / Prevention / Rules)
  - **`data-inventory`** (new): each table with PII, why it's kept, its retention period, how it's
    deleted, how it's backed up, and how it's exported
  - **`admin`** (new): the Access app, its policy, the admin routes and what gets audited
- Carry over the rules in `nerve/docs/16-engineering-standards.md`: env validation that fails hard,
  no magic defaults, constants kept with their domain, tests under `tests/`, and `@/` aliases.

### 4. Security, admin and data packages (new; extracted from WPP and LVBT's week-without-driving)

**`@williecubed/access`**, from `wpp/src/lib/access.ts` + `admin-guard.ts` and
`LasVegasForTransit/week-without-driving/apps/site/worker/admin/access.ts`:

- Verifies RS256 with WebCrypto.
- Caches the JWKS, and refetches on an unknown `kid` at most once a minute.
- Checks `aud`, `iss`, `exp`, and `nbf` with 60s of skew.
- `guardAdmin` fails closed: 503 when not configured, 403 when invalid. It **returns the verified
  identity** so it can be attached to `locals`.
- The dev bypass works only when `.dev.vars` sets `ADMIN_DEV_OPEN=1`.
- Includes a full test suite.

**`@williecubed/edge-security`**, from `wpp/src/lib/security.ts`, `asset-headers.ts`, `token.ts` and
`base64url.ts`:

- One CSP constant that produces both the Worker headers and the `_headers` file.
- `applyPrivateHeaders`.
- `readWriteRequest`, whose checks run cheapest first: size, content type, rate limit, parse,
  honeypot. It **also applies to admin POSTs** and **rejects cross-site JSON** (this fixes the gap
  in putin).
- HMAC sign/unsign with a purpose prefix.

**`@williecubed/audit`**:

- An `audit_events` D1 migration: `actor_email`, `action`, `target`, `at`, `request_id`.
- `recordAudit(env, identity, action, target)`. Every admin mutation must call it.

**`@williecubed/data`**:

- A CSV export that guards against formula injection.
- Retention-cron helpers.
- Conventions: every migration is append-only and ships with its feature, and timestamps are ISO
  strings written from app code.

**Admin pattern, the same everywhere:**

- `/admin` on the same hostname for Workers apps, or `admin.<domain>` for Vercel apps.
- An edge Access app with the app's own `<name> allow` policy listing `allow.emails`, plus the
  in-Worker check.
- The middleware gate runs before any route.
- Admin pages are never prerendered and are listed in `run_worker_first`.
- Admin actions are POST followed by a 303, with an origin check and private headers.
- Webhooks live outside `/admin` and verify their own signatures.

### 5. Infra as code: extend LVBT's `web-platform` reconciler and `platform.json`

- `platform.json` declares:
  - the Worker(s), custom domains and bindings,
  - the secrets inventory (names and steps, never values),
  - **new:** the `access` app (hostname, path, `allow.emails`; the AUD is written back into wrangler
    vars),
  - **new:** zone rules (Bot Fight Mode, rate-limit rules scoped to the hostname).
- `cube bootstrap --production [--check]` is idempotent and asks before changing anything. It works
  like WPP's `scripts/bootstrap.sh`, and secrets go in through stdin.
- It includes the least-privilege deploy-token flow from `wpp/scripts/set-deploy-token.sh`.
- Vercel projects declare the Vercel project and its env. Provisioning goes through the Vercel CLI
  and Marketplace (Neon), or Stripe Projects.

### 6. Templates

- **`template-astro-worker`**: Astro, MDX, Tailwind, D1, and `/admin` behind Access with audit
  logging. This starts as WPP's structure, cleaned up.
- **`template-next-vercel`**: Next on Vercel, plus an `apps/admin` Worker behind Access, plus
  Neon/Drizzle. It gets built in M3, when nerve needs it.

### 7. Continuity: rebuild from source

- **Requirement:** each project's own source is enough to set up its production again from nothing,
  in minutes. It covers infrastructure only; data is out of scope.
- **Projects stay independent.** Nothing configures projects centrally, and no Access policy is
  shared between projects. `repository-tooling` defines the shape only.
- **No secret is stored outside the services that use it.** Each one is minted by setup, derived
  from a resource setup creates, or issued again by a person from the manifest's steps.
- **Setup creates missing account prerequisites through the API:** the Zero Trust org and the
  identity provider (one-time PIN by default). Each app has its own `<name> allow` policy listing
  `allow.emails`.
- **Drill per project:** `bootstrap --production --account <spare> --zone <spare>`, then deploy,
  check and `teardown`, with a target of under 10 minutes. A project adopts the standard only after
  its drill passes.
- **Docs:** `docs/explanation/continuity.md` and
  `docs/explanation/decisions/issue-credentials-again.md`.

## Rollout (each milestone ships on its own)

- **M0: Docs first.**
  - Create `WillieCubed/repository-tooling` from LVBT's tree.
  - Write the standard's docs (sections 1–5 above) before changing any code.
  - Record the catalog and lint decisions, and the trigger for revisiting Oxc.
- **M1: Tooling and pilot on WPP.**
  - Parameterize the fork through `standard.config.ts`.
  - Make `bootstrap --production` create the Zero Trust org and identity provider when they are
    missing, add `--account`/`--zone` overrides and `pnpm teardown` for the drill, and add Vercel
    and Neon resources to `platform.json`.
  - Ship the config packages (adding Astro and MDX), `cube` CLI, the security, admin and data
    packages, `template-astro-worker`, `WillieCubed/.github`, and a registry of repos.
  - Migrate **WPP**:
    - Restructure into Turborepo `apps/site`.
    - Swap Biome for ESLint + Prettier.
    - Adopt `@williecubed/access` and `audit`.
    - Move Access and the WAF rules into `platform.json`.
    - Add a CSV guard, a retention policy, and a D1 Time Travel restore doc.
- **M2: putin and the reports site.**
  - Split putin off its orphan branch into its own `WillieCubed/putin` repo and adopt the standard.
  - Create the private stakeholder-reports site from the template.
- **M3: The Vercel path.**
  - Build `template-next-vercel` around **nerve**: add a remote, an admin Worker, a docs migration
    from numbered files to Diátaxis (with a registry exception that has an expiry date), and the
    catalog.
  - Then adopt the standard in **website** (willie.page).
- **M4: Hygiene preset for non-web repos.**
  - Covers claude-lms, disk-janitor, conveyor and homebrew-tap.
  - They get AGENTS.md with the symlink, the docs skeleton, community health files, Renovate,
    gitleaks and the ruleset. They don't get the web toolchain.
- **Ongoing:**
  - `standard-status.yml` reports drift across the registry every day.
  - `standard-update.yml` in each repo opens update PRs. Patch updates merge themselves; minor
    updates wait for review.

## Files to reuse

- `LasVegasForTransit/repository-tooling/`: `packages/*`, `examples/with-astro`,
  `standards/{propagate,self-update,status,owned-files,template-publication}.ts`,
  `community-health/`, `docs/` skeleton
- `Personal/wpp/src/lib/{access,admin-guard,security,asset-headers,token,base64url}.ts`,
  `src/middleware.ts`, `scripts/{bootstrap,set-deploy-token}.sh`, `.github/workflows/ci.yml`
- `LasVegasForTransit/week-without-driving/apps/site/{worker/admin/access.ts,worker/admin/gate.ts,platform.json}`,
  plus `cleanup.ts` for retention
- `Personal/nerve/docs/16-engineering-standards.md`: rules to merge in

## After approval (memory hygiene)

- Update the `deterministic-deps-and-workflow` memory: an enforced catalog is now the rule.
- Add memories for the personal standard (where it lives, the hosting rule, the lint choice and when
  to revisit Oxc).

## Verification

- **The standards repo:**
  - `pnpm check` passes.
  - Each example workspace, once copied, passes its own `pnpm check`.
  - The `standards:check` integrity hash passes.
- **`@williecubed/access` tests cover:**
  - a valid token
  - a wrong `aud` or `iss`
  - an expired token, and `nbf` inside and outside the skew
  - an unknown `kid` triggering a refetch
  - `alg: none` and HS256 being rejected
  - an unconfigured app returning 503
  - the dev bypass working only with the flag set
- **The WPP pilot:**
  - `pnpm check` passes.
  - Under `wrangler dev`, `/admin` with no JWT returns 403.
  - `curl -I https://party.willie.page/admin` without a session redirects to
    `williecubed.cloudflareaccess.com`.
  - An admin edit writes an `audit_events` row.
  - `cube bootstrap --production --check` reports no drift.
  - The CSV export escapes a cell that starts with `=`.
- **`standard-status`** shows WPP as current, and a test release opens a self-update PR in WPP.
- **Continuity drill (WPP):**
  - In a spare account and zone, `bootstrap --production` plus deploy brings WPP up in under 10
    minutes, with no dashboard step.
  - `/admin` redirects to Access there.
  - `teardown` removes it, and a second `bootstrap --production` in the real account changes
    nothing.
