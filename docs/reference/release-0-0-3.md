# Repository tooling 0.0.3

A repository can now build and deploy a Cloudflare app with Cloudflare's `cf` CLI. A repository that
keeps deploying with Wrangler works as before.

- `pnpm run deploy` deploys an app that has `cloudflare.config.ts` with
  `pnpm exec cf deploy --message "Commit <sha>"`, after the same single `pnpm build`, and refuses a
  working tree with changes as before. `--dry-run` becomes `cf deploy --dry-run`. An app that also
  keeps its wrangler config, as `cf migrate` leaves it, deploys with cf. An app with only
  `wrangler.jsonc`, `wrangler.json`, or `wrangler.toml` deploys with Wrangler; that path is now
  legacy.
- `pnpm preflight` checks a cf project's sign-in with `cf auth whoami`: a `cf auth login`, or a
  `CLOUDFLARE_API_TOKEN` that Cloudflare accepts. `cf` keeps its own credentials, so run
  `pnpm exec cf auth login` once; a Wrangler sign-in does not count for a cf project. A repository
  with both kinds of app gets both checks.
- The catalog adds `cf` 1.0.0-beta.20 and `@cloudflare/vite-plugin` 2.0.0-beta.v.3. Both are betas
  built on `@cloudflare/config` 0.27.0, so they move together. They install with the existing
  `allowBuilds` list.
- The templates' `.gitignore` ignores `.cloudflare/`, where `cf` writes its Build Output and types,
  and `@williecubed/eslint-config` no longer lints it.
- The shared setup action pins pnpm/action-setup 6.1.0 and actions/setup-node 7.1.0 by commit SHA.
  Both keep the Node 24 action runtime, and the Node, pnpm, registry, cache, and authentication
  inputs are unchanged.
- A new review rule: new personal web apps follow the [PWA baseline](personal-web-apps.md).

The examples still deploy with Wrangler. Converting them changes how each app builds, which this
release does not test, so they move in a later release. To move an app now, follow
[Move an app to cf](../how-to/move-an-app-to-cf.md). Production setup (`pnpm bootstrap --production`
and `pnpm preflight --production`) still works through Wrangler and reads the wrangler config, so an
app with a `platform.json` keeps both files.

A repository on 0.0.2 copies `.github/actions/setup-node-pnpm/action.yml` from its template by hand,
and a repository that is not a template adds `.cloudflare/` to its `.gitignore` and the two catalog
entries to its `pnpm-workspace.yaml`. The `Standard update` pull request cannot write the action,
because a workflow's own token may not change workflow files.

The three rules that 0.0.2 said would fail from v0.0.3 fail from v0.0.4 instead, because this
release only adds cf support: the `.gitkeep` placeholder warning, the re-pinned catalog entry
warning, and the `ci` commit type warning.
