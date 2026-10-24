# Move an app to cf

This guide moves one Cloudflare app from Wrangler to Cloudflare's `cf` CLI, so `pnpm run deploy`
deploys it with `cf deploy`. An app is a cf project once it has a `cloudflare.config.ts`; until then
it deploys through the legacy Wrangler path, which keeps working.

`cf` is in beta. The catalog pins `cf` and `@cloudflare/vite-plugin` as a pair built on the same
`@cloudflare/config`, so an app adds both and they move together.

## Before you start

- The repository is on standard 0.0.3 or later, and the catalog in its `pnpm-workspace.yaml` has the
  `cf` and `@cloudflare/vite-plugin` entries from `packages/cli/catalog.json`. A template repository
  gets them with its 0.0.3 update; any other repository copies the two lines.
- The working tree is clean, and `pnpm install` has run.
- You have not run `cf dev`, `cf build`, or `cf deploy` in the app. Without `cloudflare.config.ts`,
  they write a configuration of their own.

## 1. Add cf to the app

```bash
pnpm --filter ./apps/site add -D cf@catalog: @cloudflare/vite-plugin@catalog:
```

Commit the change. `cf migrate` stops on a working tree with changes.

## 2. Convert the wrangler config

In the app's directory, preview the conversion, then run it. `--no-install` keeps the `catalog:`
entries from step 1 instead of adding `cf` again at another version.

```bash
cd apps/site
pnpm exec cf migrate --bundler vite --no-install --dry-run
pnpm exec cf migrate --bundler vite --no-install
```

`cf migrate` writes `cloudflare.config.ts` beside the wrangler config and leaves the wrangler config
unchanged. Each `[required]` item it prints is also a `TODO(@cloudflare)` comment in the new file,
above a `throw` that stops every build until you delete it. Resolve each item as Cloudflare's
[Migrate a Wrangler project](https://developers.cloudflare.com/cf/wrangler/migrate/) describes, then
delete the `throw`. Its "Choose a bundler" section shows the `cloudflare()` plugin that
`vite.config.ts` needs for the Vite bundler.

## 3. Finish the app

- Replace any Wrangler command in the app's scripts with its cf equivalent, such as `wrangler dev`
  with `cf dev`, because Wrangler ignores `cloudflare.config.ts`. Do not give the app a `deploy`
  script: the root `pnpm run deploy` runs `cf deploy` in it.
- Add `cloudflare.config.ts` and `.cloudflare/types` to the app's `tsconfig.json` `include`.
- Make sure `.cloudflare/` is in the root `.gitignore`. Templates from 0.0.3 ignore it; an older
  repository adds the line. `cf` writes its Build Output there, and `cube deploy` refuses a working
  tree with changes.
- Keep the wrangler config when the app has a `platform.json`. Production setup and
  `pnpm preflight --production` still read it and still work through Wrangler, so its `name`,
  `vars`, and bindings must keep matching `cloudflare.config.ts`. `cube deploy` uses
  `cloudflare.config.ts` when both exist. Without a `platform.json`, delete the wrangler config once
  nothing else in the app reads it, such as a `@cloudflare/vitest-pool-workers` test setup.

## 4. Check, then deploy

```bash
pnpm preflight
pnpm check
pnpm run deploy --dry-run
```

The Cloudflare preflight check now asks `cf auth whoami`, because `cf` keeps its own credentials and
a Wrangler sign-in does not count. Sign in once with `pnpm exec cf auth login`. The dry run builds
and validates the Worker without uploading it.

The Deploy workflow needs no change. `cf deploy` reads the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` it already sets, and records `Commit <sha>` on the Worker Version as
Wrangler did.
