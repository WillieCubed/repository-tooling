# Resource usage

Rules for what projects spend: provider quotas and money in the cloud, and disk on Willie's
machines.

## Cloud limits

Every personal project on Cloudflare shares one account, so every daily pool below is shared too.
The standard puts the account on Workers Paid, as recorded in
[Workers Paid for the personal account](../explanation/decisions/workers-paid.md).

| Resource              | Limit                                                                                     | Source                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Workers Paid          | $5 a month minimum; 10 million requests and 30 million CPU ms included                    | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)       |
| Workers Free          | 100,000 requests a day per account, 10 ms CPU per invocation                              | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)         |
| Workers AI            | 10,000 neurons a day free, reset 00:00 UTC; $0.011 per 1,000 neurons beyond on Paid       | [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| D1 Free               | 5 million rows read and 100,000 written a day                                             | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)                 |
| KV Free               | 100,000 reads and 1,000 writes a day                                                      | [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)                 |
| Cron triggers         | 5 per account on Free, 250 on Paid                                                        | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)         |
| Zone rate-limit rules | 1 per zone on Free, with a 10 s period and a 10 s block                                   | [Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)    |
| Vercel Hobby          | 1 million invocations and 4 CPU-hours a month, 100 deployments a day; non-commercial only | [Hobby plan](https://vercel.com/docs/plans/hobby)                                    |

## A `Limits` section in every app

Each deployed app's `operations.md` has a `Limits` section. It lists every metered resource the app
uses, the plan's limit with a link, the app's expected peak with the arithmetic that produced it,
and what a visitor sees when the limit is reached. `cube check documents` requires the section.

## Guarded paid endpoints

A public endpoint that spends money or draws on a shared daily pool has three guards: a per-client
limit, a daily ceiling below the pool, and a designed state at the ceiling, such as a hand-written
fallback. An endpoint that calls a model provider without a signed-in user or a rate limit lets one
script spend to the provider's monthly cap.

## A cap at each provider

Each paid provider caps each project where the provider allows it:

- **Anthropic:** one workspace per project, with its own monthly spend limit
  ([rate limits](https://platform.claude.com/docs/en/api/rate-limits)).
- **Vercel:** an app that takes payments is commercial use, which the Hobby plan forbids. It runs on
  a Pro team with Spend Management and "Pause Production Deployments" on
  ([Spend Management](https://vercel.com/docs/spend-management)).
- **Cloudflare:** an account budget alert
  ([budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/)). It notifies
  and never caps, and it exists only in the dashboard.

## No Vercel builds for agent branches

Vercel projects set `git.deploymentEnabled` to `false` for `claude/**` and `codex/**`. Agents push
many short-lived branches, and Hobby allows 100 deployments a day and one build at a time.

## Local disk

These rules apply to Willie's machines, not to project source. The shared Cargo target directory and
pnpm's clone linking already keep build output from being copied per worktree.

- **Worktrees are cleaned by what git knows.** A weekly job walks `git worktree list` for every
  repository under `~/Projects` and for `~/.codex/worktrees`. It runs `git worktree remove`, without
  `--force`, on a worktree whose branch is merged or deleted on the remote, or which is clean and
  untouched for 14 days. A dirty worktree is reported, not removed.
- **Emulators are reported, not deleted.** The same job reports Android virtual devices untouched
  for 30 days and system images no device uses, and runs `xcrun simctl delete unavailable`. Devices
  can hold app state, so a person deletes them.
- **Docker has a ceiling.** Docker Desktop's disk usage limit is 64 GiB.
- **Preflight warns on low disk.** `pnpm preflight` warns under 50 GiB free and fails under 15 GiB,
  printing the cleanup command as the fix. A full disk makes builds fail with errors that do not
  mention space.

`disk-janitor` runs the weekly job.
