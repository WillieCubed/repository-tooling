# Create a repository

This guide starts a new personal repository that has the same structure, commands, and rules as
every other one. The standard is a GitHub template repository, so creating one is a button click,
and the shared rules arrive as ordinary dependencies.

## Before you start

- You can create repositories under the `WillieCubed` account.
- Node.js 24 or newer and git are installed on your machine. pnpm is activated by Corepack if it is
  missing (`corepack enable`).
- Your machine can install from GitHub Packages, where the `@williecubed/*` packages live. Run
  `gh auth refresh --scopes read:packages`, add
  `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` to `~/.npmrc`, and export
  `NODE_AUTH_TOKEN=$(gh auth token)` in your shell profile.
  [Installation and updates](../reference/installation.md#authentication) explains each part.
- You know the repository's durable commit scopes: the two to six boundaries a change can belong to,
  such as `web`, `worker`, `docs`, `dx`. A scope is never a feature, file, task, or role.

## 1. Create the repository from a template

Pick the template that matches what the repository ships:

| Template                   | For                                                       |
| -------------------------- | --------------------------------------------------------- |
| `template-basic`           | Libraries, CLIs, and Cloudflare Workers without a site    |
| `template-with-astro`      | A content site: Astro on Cloudflare Workers static assets |
| `template-with-vite-react` | An application: Vite and React on Cloudflare Workers      |

Either open the template on GitHub (for example
[WillieCubed/template-basic](https://github.com/WillieCubed/template-basic)) and press **Use this
template → Create a new repository**, or from a terminal:

```bash
gh repo create WillieCubed/<your-repo> --template WillieCubed/template-basic --private --clone
cd <your-repo>
```

Each template is published from the matching directory under `examples/` in this repository on every
release, so it is always the current standard. Use the published template rather than copying an
example directly: publication copies the example at a release tag, so every `@williecubed/*` version
and the plugin ref name that release.

## 2. Bootstrap and check

```bash
pnpm bootstrap
pnpm check
```

`bootstrap` installs dependencies (the `prepare` script points git at `.githooks`), then runs
`preflight`, which confirms Node, pnpm, hooks, GitHub CLI, and Cloudflare access and names the fix
for anything missing. `check` runs the format check, then lint, typecheck, and tests through
Turborepo, exactly as CI does. Both pass on a fresh copy. The `@williecubed/*` packages install from
GitHub Packages at the exact release the template pins, and `check` confirms that the files the
standard owns match the installed `@williecubed/cli`.

## 3. Make it yours

- Rename the root package in `package.json`.
- Rename `packages/example`, `apps/site`, or `apps/app` to your first real package or app, or
  scaffold one with `turbo gen workspace` and delete the sample. Deployable templates also need the
  Worker name in `apps/*/wrangler.jsonc` and, for a site, `site` in `astro.config.ts`.
- Replace the scopes in `.williecubed/commit-scopes.txt` with this repository's boundaries.
- `.github/workflows/ci.yml` runs a job named `Validate`. Keep that name: the standard ruleset
  requires it on every pull request. Add steps to the job.
- `AGENTS.md` carries the paragraphs agents need. Add repository-specific guidance below them.

The repository keeps itself on the standard: its `Standard update` workflow opens a pull request for
each newer release, as [Installation and updates](../reference/installation.md) describes.

## 4. Commit and register

```bash
git restore --staged . && git add -A && git commit -m "chore(dx): start from the repository standard"
git push
```

Then add the repository to `standards/repositories.json` here with `"kind": "consumer"`, so the
standard ruleset applies and `Standard status` tracks it. Its workflows install the `@williecubed/*`
packages with their own token, so give the repository read access to each package in the package's
settings on GitHub, under **Manage Actions access**. A deployable repository also needs the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets in a `production` environment before
`.github/workflows/deploy.yml` can run.

## Common problems

**`pnpm install` fails with a 401 or 403 from `npm.pkg.github.com`**: pnpm has no token for GitHub
Packages. `pnpm preflight` names the fix; the prerequisites above list it.

**`cube check owned` fails**: a file the standard owns was changed. Run `pnpm exec cube update` to
restore it, and make the shared change in repository-tooling instead.

**`turbo` cannot find a task**: every package must declare `lint`, `check-types`, and `test` scripts
(and `build` where it builds). Copy them from `packages/example/package.json`.

**The commit hook rejects your scope**: the scope is not in `.williecubed/commit-scopes.txt`. Add it
if it is a durable boundary, or omit the scope.
