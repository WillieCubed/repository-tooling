# Repository tooling 0.0.2

A repository created from a template now passes CI on its first push. Nothing in a repository's own
code changes.

- The templates' `ci.yml` and `deploy.yml` grant the workflow token `packages: read`. Without it,
  installing `@williecubed/*` from GitHub Packages failed with 403 on every run. A test fails when
  an example workflow that installs dependencies lacks the permission.
- The templates' `deploy.yml` skips the deploy with a notice until the `production` environment has
  a `CLOUDFLARE_API_TOKEN`, instead of failing every push to `main` before production is set up.

A repository on 0.0.1 gets both changes by copying `ci.yml` and `deploy.yml` from its template by
hand. The `Standard update` pull request cannot write them, because a workflow's own token may not
change workflow files.

The three rules that 0.0.1 said would fail from v0.0.2 fail from v0.0.3 instead, because this
release only fixes CI: the `.gitkeep` placeholder warning, the re-pinned catalog entry warning, and
the `ci` commit type warning.
