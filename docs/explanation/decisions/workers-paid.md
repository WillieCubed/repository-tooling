# Workers Paid for the personal account

Decided 2026-09-28. Applying it is a purchase in the Cloudflare dashboard, which Willie makes.

## Decision

The personal Cloudflare account moves to Workers Paid, at
$5 a month minimum, with a budget alert
around $15.

## Why

On the Free plan every daily pool is shared by every project: 100,000 requests, 10,000 Workers AI
neurons, 5 million D1 rows read, and 1,000 KV writes, each failing hard until 00:00 UTC. One
project's spike, or one bot, stops every other project for the rest of the day. putin's one-word
mode covers about 25 worst-case rounds a day before it answers 503, from its token caps. Paid turns
those cliffs into metered cost, and each project's `Limits` section then states its own share.

## Rejected

- **Staying on Free** with each project claiming a share of each pool. The shares would add up to a
  number someone keeps across projects by hand.
- **Staying on Free and moving putin's model calls to a paid provider** through AI Gateway. It adds
  a provider key to issue again on every rebuild, and leaves the other pools shared.

## Consequences

The budget alert notifies and never caps. A guarded endpoint's daily ceiling, not the plan, is what
stops runaway spend.
