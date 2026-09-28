# Rebuilding from source

Each project's source is enough to set up its production again from nothing. If every Cloudflare,
GitHub, and Vercel resource a project uses disappeared, one command in that project's checkout would
provision and deploy it again within minutes. Projects are independent: each rebuilds on its own,
from its own repository, and none depends on another project or on this repository being configured
first.

## What a rebuild starts from

1. **The project's source**, including its `platform.json`, wrangler config, and migrations.
2. **Sign-ins.** A browser session for GitHub, Cloudflare, and Vercel, the same ones a person uses
   every day, and a short-lived Cloudflare token from the prefilled link setup prints.
3. **Any value no API can create**, issued again by a person from the steps in the manifest. Most
   projects have none.

```bash
pnpm bootstrap
pnpm bootstrap --production
pnpm run deploy
```

## Where each secret comes from

| Kind    | Where the value comes from                                      | Example                                                                                       |
| ------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Minted  | Setup generates random bytes                                    | An HMAC key for signed links                                                                  |
| Derived | A resource setup creates returns it                             | An Access audience tag, a Turnstile secret, a D1 id, a Neon connection string, a deploy token |
| Issued  | A person creates it from the manifest's steps, once per rebuild | A Google OAuth client secret, a model provider's API key                                      |

No secret is stored anywhere except the service that uses it. Minted values need no copy because a
rebuild does not bring data back: the links and sessions an old key signed belong to data that no
longer exists. Derived values need no copy because setup creates the resource that holds them.
Issued values are cheaper to issue again than to keep safe in a second place.

## Nothing is set only in a dashboard

A setting that can only be changed in a dashboard is a gap in the standard, because the source no
longer describes production. The Zero Trust organization, sign-in methods, Access applications and
policies, Turnstile widgets, Web Analytics sites, zone settings, rate-limit rules, account API
tokens, Vercel projects, and Neon databases all have APIs, so setup creates them from the manifest.
Verifying an email domain with Resend is the one remaining step that waits for a person.

## What stays outside source

- **The accounts themselves**: GitHub, Cloudflare, Vercel, Neon, Resend, and the Google Cloud
  project that owns any OAuth client.
- **Domain registration and nameservers.** A zone can be created by API, but pointing a registrar at
  it cannot, unless the domain is registered with Cloudflare Registrar.
- **Data.** A rebuild creates empty databases and applies every migration. Restoring rows or files
  is a separate decision, made per incident. D1 Time Travel and Neon's point-in-time restore cover
  ordinary mistakes inside a working account.

## Minutes, measured

Setup asks every question first, then runs without stopping. The target is under ten minutes from
the last answer to the app answering on its hostname.

The target is tested, not assumed. A project's continuity drill runs setup against a spare
Cloudflare account and zone, deploys, checks the app, and deletes what it created:

```bash
pnpm bootstrap --production --account <spare-account-id> --zone <spare-zone>
pnpm run deploy -- --account <spare-account-id> --zone <spare-zone>
pnpm teardown --account <spare-account-id>
```

`teardown` refuses the account in the project's manifest. A drill that takes longer than ten
minutes, or stops for a dashboard step, is a defect to fix in the standard. A project adopts the
standard only after its drill passes.
