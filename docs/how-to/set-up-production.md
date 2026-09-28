# Set up a repository's production platform

This guide takes a repository from "the code is ready" to "production has everything it needs": its
database and bucket, bot check, admin sign-in, email, secrets, and deploy credentials. You declare
those things once in a `platform.json` file, then one command checks them and another sets up
whatever is missing. Run the same two commands again at any time. On a finished setup they change
nothing and say so.

## Before you start

- `pnpm bootstrap` passes on your machine. That means Node.js, pnpm, the GitHub CLI (signed in with
  `gh auth login`), and Wrangler (signed in with `pnpm exec wrangler login`) all work.
- Your Cloudflare user can administer the personal account (ID `18f90fa11cf0a87145be4a1517e41217`),
  including Cloudflare One, which Cloudflare used to call Zero Trust. Its Access team is
  `williecubed`.
- Your GitHub user is an admin of the repository, so it can create environments and their secrets.
- For email, you can sign in to the Resend account.
- The site's zone, usually `willie.page`, is in the same Cloudflare account.

## 1. Declare what production needs

If the repository already has a `platform.json` next to its production `wrangler.jsonc`, skip to
step 2. Otherwise create `apps/<app>/platform.json` (or `platform.json` at the root of a single-app
repository), starting from the example in the
[platform manifest reference](../reference/platform-manifest.md). List every binding the Worker
reads from `env`: the D1 databases and R2 buckets, each secret with its purpose and the steps to
find it, the vars, any Turnstile widget and Access application, the email domain, and the GitHub
environment secrets the deploy workflow uses. Add every preview-only value to `forbidden`.

For a secret a person types in, such as the Resend key or the deploy token, copy the steps from
[What to enter in each dashboard](#what-to-enter-in-each-dashboard) below, so the person running
setup is never left guessing.

Then run the repository check, which validates the file:

```bash
pnpm check
```

A mistake prints the field and what is wrong with it, such as
`$.secrets[0].name: "resend-key" does not match ^[A-Z][A-Z0-9_]*$`. Commit the file with the change
that needs it.

## 2. See what production is missing

```bash
pnpm preflight --production
```

After the machine checks, this prints one line per item, grouped by section, and changes nothing:

```text
party.willie.page production (apps/site/platform.json)

D1 databases
  ok    wpp                     exists and is bound as DB
  ok    wpp migrations          all 12 applied

Secrets
  FAIL  RSVP_TOKEN_KEY → Worker wpp   is not set; needed for signing guests' edit links
                                      next: pnpm bootstrap --production generates it

Not ready for production. 10 of 14 ready, 3 needed now, 1 recommended.
```

`FAIL` means production needs the item now. `WARN` means only a feature that is not built yet needs
it, or it is recommended. The `next:` line under each one says what fixes it. If a line says "could
not check", read its reason: usually a sign-in has expired (`pnpm exec wrangler login` or
`gh auth login`), or it needs the Cloudflare token that step 3 asks for.

## 3. Set up what is missing

```bash
pnpm bootstrap --production
```

It installs, runs the machine checks, prints the same report, lists what it is about to do, and asks
once before it starts. Answer the questions as they come:

- **A Cloudflare API token for Turnstile and Access.** Wrangler's sign-in cannot read or manage
  these, so the command prints a link that opens Cloudflare's token page with the permissions
  already chosen, and numbered steps. It asks on every run, even when everything is set up, because
  it cannot check Turnstile and Access without it. The token stays in the terminal's memory and is
  never saved. Press Enter instead to leave Turnstile and Access unchecked for now.
- **Secret values.** For each value it cannot make itself, the command says in one sentence what the
  value is for, whether it is fine to skip, the page to open, and numbered steps. It offers to open
  the page. Paste the value when asked; it does not appear on screen. A value that does not look
  right is asked for again. Press Enter to skip one for now.
- **Dashboard steps.** Only verifying an email domain in Resend has no API. For that, the command
  prints the steps, offers to open the page, and waits for you to press Enter. Cloudflare One and
  the sign-in method are created through the API when the account lacks them.
- **Features not built yet.** Before it starts, the command asks whether to also set the values that
  only such features need. The default is to leave them for later.

Everything else happens without questions: databases, buckets, and migrations; the Turnstile widget
and the Access application with its allow policy; generated secrets; the GitHub environment; and
values the command already knows, such as the account ID or the team domain. When it finds a value
that must not be in production, it offers to delete it.

The run ends with a fresh report. If something is still open, finish the step it names and run
`pnpm bootstrap --production` again. It starts from what exists each time, so it picks up exactly
where you stopped.

## 4. Commit the config changes it asks for

The command never edits the wrangler config, because a config change should be reviewed. When the
report says a var is missing, such as the Turnstile site key, or a `database_id` differs, it prints
the exact line to change. Make that change on a branch, open a pull request, and merge it. The next
deploy from `main` carries it. A database the command created in this run gets its migrations on the
next run, once the config names its `database_id`.

## 5. Confirm production is ready

```bash
pnpm preflight --production
```

The last line should read `Ready for production.` Delete the Cloudflare token you created in step 3
at <https://dash.cloudflare.com/profile/api-tokens> if it has not expired yet.

To check production from CI, run the same command with `CLOUDFLARE_API_TOKEN` (for Wrangler),
`GH_TOKEN` (for `gh`), and `CUBE_CLOUDFLARE_SETUP_TOKEN` (a read-only token for Turnstile and
Access) in the environment. It exits 1 when production is not ready.

## Running it again, and replacing a value

`pnpm bootstrap --production` is safe to run as often as you like. Each step checks before it acts:

- A database, bucket, widget, Access application, allow policy, or GitHub environment that exists is
  found by name and left alone. It is never created twice.
- A secret that is already set is never asked for, generated, or copied again, even if you would
  type a different value. Setup can see only a secret's name, never its value.
- Migrations that are already applied are skipped.
- The wrangler config is never rewritten.

On a finished setup, the command prints "Nothing was changed" and exits 0.

To replace a secret on purpose, for example after a leak, name it with `--rotate`:

```bash
pnpm bootstrap --production --rotate SIGNING_SECRET
```

The command asks before it replaces anything. A generated secret gets a new random value, a secret a
person types is asked for again, and a secret a Turnstile widget or Access application feeds is
copied from it again. The new value is stored on every target the secret lists. To replace the
Turnstile secret itself, first rotate it in the dashboard (the widget's Settings, then "Rotate
Secret Key"), then run the command with `--rotate TURNSTILE_SECRET`.

If a generated secret is set on one target but missing from another, the report says so instead of
generating a second value, because the two would then disagree. `--rotate` fixes it by storing one
new value everywhere.

## What to enter in each dashboard

The command prints these steps when it needs them. They are here too, so you can read them ahead or
follow them without the command. Each one assumes you have never used the service before, and none
asks you to copy a second value before you have pasted the first.

### Cloudflare One (Zero Trust) and the sign-in method

`pnpm bootstrap --production` creates both when the account lacks them: the Zero Trust organization
with the team domain `williecubed`, and the identity provider the manifest names. One-time PIN needs
nothing more; Access emails a code to the address a person types, and the application's allow policy
decides whether that address gets in.

A manifest that names `google` instead needs an OAuth client, which only a person can create:

1. In a Google Cloud project you own, open "Google Auth Platform", then "Clients", and click "Create
   client".
2. Choose the application type "Web application".
3. Add the authorized JavaScript origin `https://williecubed.cloudflareaccess.com` and the
   authorized redirect URI `https://williecubed.cloudflareaccess.com/cdn-cgi/access/callback`.
4. Click "Create". When setup asks for the client ID, copy it and paste it at the prompt. Then copy
   the client secret and paste it at the next prompt.

Changing the team domain later breaks every admin sign-in until every `ACCESS_TEAM_DOMAIN` secret,
and the Google OAuth client if one is used, are updated to match.

### An Access application

`pnpm bootstrap --production` creates the application when it has the Cloudflare token. To create it
by hand instead, use exactly the names in `platform.json`, so setup recognizes what you made rather
than creating a second one. It finds an application by its name, or else by its paths. The steps
below use WPP's admin pages on `party.willie.page`.

1. Open <https://one.dash.cloudflare.com/> with the personal account and go to Access controls, then
   Applications. If the application is already listed, skip to step 10.
2. Click "Create new application" at the top right (some screens say "Add an application").
3. In the "Add an application" dialog, under "Self-hosted and private", choose the "Public DNS" tab
   and click "Continue with Self-hosted and private".
4. Under "Destinations", fill in one public hostname row per path, with "+ Add public hostname" for
   each extra row. For WPP there are two rows, each with Subdomain `party`, Domain `willie.page`,
   and the paths `admin` and `admin/*`. A path does not cover the paths under it, and a wildcard
   does not cover its parent, so both are needed; with one missing, that part of the site is open to
   anyone.
5. Under "Access policies", click "Create new policy", name it exactly `<name> allow` (such as
   `party.willie.page admin allow`), set the action to "Allow", and add one Include rule with the
   selector "Emails" and each address in the manifest's `allow.emails`. Do not add "Everyone" or an
   email domain. Save it, then choose it under "Add current policies".
6. Under "Authentication", turn off "Accept all available identity providers", choose only the
   method `platform.json` names, and turn on "Apply instant authentication".
7. Under "Details", type the name exactly as `access.name` in `platform.json`, such as
   `party.willie.page admin`. Keep "Session Duration" at "24 hours".
8. Click "Create".
9. Open the application again with "Configure".
10. On the "Additional settings" tab, under "Cookie settings", turn on "Enable Binding Cookie" if it
    is off. When setup asks for `ACCESS_AUD`, copy "Application Audience (AUD) Tag" (64 lowercase
    letters and digits) from the same tab and paste it at the prompt.

### A Turnstile widget

1. Open <https://dash.cloudflare.com/18f90fa11cf0a87145be4a1517e41217/turnstile>. If a widget with
   the site's name is listed, click it and skip to step 5.
2. Click "Add widget" and type the widget name, which is the site, such as `party.willie.page`.
3. Under "Hostname management", add the site's hostname.
4. Choose the widget mode "Managed", leave pre-clearance off, and click "Create".
5. Copy the Site Key, which is public and starts with `0x`, and paste it into `"vars"` in the
   production wrangler config as `TURNSTILE_SITE_KEY`. Save the file; it goes in through a pull
   request. Skip this step if the config already has this widget's Site Key.
6. When setup asks for `TURNSTILE_SECRET`, copy the Secret Key, which is private and also starts
   with `0x`, and paste it at the prompt.

### The Cloudflare API tokens

Setup uses a short-lived token that it never saves, and the deploy workflow uses a long-lived one
stored in GitHub.

The setup token lets `pnpm bootstrap --production` read and create Turnstile widgets and Access
applications:

1. Open the link the command prints. It opens "Create Custom Token" at
   <https://dash.cloudflare.com/profile/api-tokens> with the permissions filled in.
2. Name it `cube setup <site>`.
3. Check that "Permissions" has exactly these three rows, each set to "Account": "Turnstile" with
   "Edit", "Access: Apps and Policies" with "Edit", and "Access: Organizations, Identity Providers,
   and Groups" with "Read". Add any that is missing with "+ Add more".
4. Under "Account Resources", choose "Include" and the personal account, not "All accounts".
5. Under "TTL", set the end date to tomorrow.
6. Click "Continue to summary", then "Create Token", then "Copy". Cloudflare shows it only once.
   Paste it into the terminal, and delete it when you finish.

The deploy token lets the Deploy workflow publish the Worker. It becomes the GitHub environment
secret `CLOUDFLARE_API_TOKEN` in the `production` environment. Make it an account API token, which
belongs to the account rather than to your user, so deploys keep working if your user's access
changes. Creating one needs the Super Administrator role on the account. Wrangler deploys with it
because the workflow also sets `CLOUDFLARE_ACCOUNT_ID`; without that, Wrangler would ask Cloudflare
for the token's memberships, which an account API token cannot read.

1. Open the Cloudflare dashboard, choose the personal account, and go to Manage Account, then
   "Account API Tokens" (<https://dash.cloudflare.com/18f90fa11cf0a87145be4a1517e41217/api-tokens>).
   Click "Create Token", then "Create Custom Token".
2. Name it `<site> deploy (GitHub Actions)`, such as `party.willie.page deploy (GitHub Actions)`.
3. Under "Permissions", add these rows: "Account", "Workers Scripts", "Edit"; "Account", "Account
   Settings", "Read"; and "Zone", "Workers Routes", "Edit". Add "Account", "D1", "Edit" only if the
   deploy workflow applies migrations, and "Account", "Workers R2 Storage", "Edit" only if it writes
   to a bucket.
4. Under "Zone Resources", choose "Include", then "Specific zone", then the site's zone, such as
   `willie.page`.
5. Leave the expiration empty, so deploys keep working. Click "Continue to summary", then "Create
   Token", then "Copy"; Cloudflare shows it only once. Paste it when setup asks for
   `CLOUDFLARE_API_TOKEN`. If it ever leaks, roll it on the same page and store the new one with
   `pnpm bootstrap --production --rotate CLOUDFLARE_API_TOKEN`.

Setup copies `CLOUDFLARE_ACCOUNT_ID` into the same environment by itself.

The setup token above stays a personal, short-lived token: Cloudflare's account API tokens cannot
manage Turnstile.

### Resend

1. Sign in at <https://resend.com/login>, or sign up at <https://resend.com/signup> if you have no
   account.
2. On the Domains page, click "Add Domain", type the sending domain (such as `notify.willie.page`),
   choose the region "North Virginia (us-east-1)", and click "Add". The region must match
   `email.region` in `platform.json`.
3. On the domain's page, click "Sign in to Cloudflare" and approve the request. It adds every DNS
   record for you.
4. To add the records by hand instead, open the zone's DNS records page in the Cloudflare dashboard
   and add each with TTL "Auto" and Proxy status "DNS only": an MX record named `send` with the mail
   server `feedback-smtp.us-east-1.amazonses.com` and priority 10; a TXT record named `send` with
   the content `v=spf1 include:amazonses.com ~all`; and a TXT record named `resend._domainkey` with
   the long `p=` value Resend shows. For a subdomain such as `notify.willie.page`, add the subdomain
   to each name, as in `send.notify`.
5. Add the DMARC record Resend recommends: a TXT record named `_dmarc` with the content
   `v=DMARC1; p=none;`.
6. Click "Verify DNS Records" and wait until the domain's status says "Verified". It usually takes a
   few minutes; DNS can take up to 72 hours.
7. Open <https://resend.com/api-keys> and click "Create API Key". Name it after the Worker, such as
   `party.willie.page Worker`, choose the permission "Sending access", choose the verified domain,
   and click "Add".
8. Copy the key, which starts with `re_` and is shown only once, and paste it when setup asks for
   `RESEND_API_KEY`.

### Cloudflare Web Analytics

A site that counts visits with Cloudflare Web Analytics needs the site's token at build time. It is
public, so it is a GitHub environment variable, not a secret.

1. Open <https://dash.cloudflare.com/18f90fa11cf0a87145be4a1517e41217/web-analytics> and click "Add
   a site". Type the site's hostname, such as `party.willie.page`.
2. Choose "Enable with JS Snippet installation", not the automatic option, because the site loads
   the beacon itself.
3. Open "Manage site" to see the JS snippet. Copy only the token inside
   `data-cf-beacon='{"token": "..."}'`.
4. In the GitHub repository, open Settings, then Environments, then `production`. Under "Environment
   variables", click "Add environment variable", name it `PUBLIC_CWA_TOKEN`, and paste the token.

### GitHub environments

Setup creates a missing environment itself. To create one by hand, open the repository's Settings,
then Environments, then "New environment", type its name (such as `production`), and click
"Configure environment". Add secrets under "Environment secrets" with "Add environment secret", and
variables under "Environment variables" with "Add environment variable". Only repository admins can
configure environments.

## When something goes wrong

| What you see                                             | What to do                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `could not check: Wrangler has no credential`            | Run `pnpm exec wrangler login`, then the command again.                                                |
| Turnstile or Access says `403` or `Authentication error` | The token lacks a permission. Create a new one from the link; check every permission it lists.         |
| `Zero Trust is not turned on for this account`           | Follow the first-time steps above, then run it again. Access items wait until it is on.                |
| `does not bind DB to …` or a `database_id` mismatch      | Edit the wrangler config as the `next:` line says, through a pull request.                             |
| Migrations "wait until" the config has a `database_id`   | Put the id the report shows in the wrangler config through a pull request, then run the command again. |
| A secret "is set on … and setup cannot read that value"  | Run `pnpm bootstrap --production --rotate <NAME>` to store one new value everywhere.                   |
| An email record stays missing after Resend says Verified | DNS can take a few minutes to spread. Run the check again later.                                       |
| `bootstrap --production … needs a terminal`              | Run it in a terminal, not through CI or a pipe. Use `pnpm preflight --production` to only check.       |
| Google sign-in fails after the team domain was changed   | Change it back, or update every `ACCESS_TEAM_DOMAIN` and the Google OAuth client's two addresses.      |
