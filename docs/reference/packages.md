# The shared packages

Every personal repository depends on these packages. A released preset vendors them under
`.williecubed/web-platform`, so each dependency resolves to that immutable local snapshot:

```json
"@williecubed/typescript-config": "file:../../.williecubed/web-platform/packages/typescript-config"
```

All packages share one version, the tooling version. `.williecubed/web-platform.json` records the
release, commit, and content hash for the complete preset rather than versioning packages
independently.

| Package                          | What a repository gets                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@williecubed/typescript-config` | `base.json` (strict, ES2024, bundler resolution, the `development` export condition for workspace packages, unchecked-index and unused checks), `node.json`, `browser.json`, `worker.json`, `react-library.json`, and `astro.json` (the browser target with the options Astro's own strict config sets, inlined so no second copy of Astro is ever resolved) |
| `@williecubed/eslint-config`     | `config` arrays from `./base`, `./browser` (base plus browser globals), and `./react-internal`: strict and stylistic type-checked rules, suppression hygiene, shape caps, four SonarJS rules, the Turborepo env rule, Prettier last. Owns its plugins                                                                                                        |
| `@williecubed/prettier-config`   | The Prettier settings object: 100 columns, single quotes, trailing commas, wrapped prose                                                                                                                                                                                                                                                                     |
| `@williecubed/vitest-config`     | `sharedConfig`: unit tests under `tests/`, empty suites fail                                                                                                                                                                                                                                                                                                 |
| `@williecubed/playwright-config` | `sharedConfig`: end-to-end tests under `tests/e2e/*.spec.ts`, desktop and mobile projects, traces on failure, retries in CI; accessibility and browser-health assertions                                                                                                                                                                                     |
| `@williecubed/cli`               | The `cube` command (`bootstrap`, `preflight`, `check`, `deploy`), the git hooks, the `willie-contributions` agent plugin, and the version catalog                                                                                                                                                                                                            |

## How a package uses them

```js
// packages/<name>/eslint.config.js
import { config } from '@williecubed/eslint-config/base';
export default config;
```

```json
// packages/<name>/tsconfig.json
{ "extends": "@williecubed/typescript-config/node.json", "include": ["src", "tests"] }
```

```ts
// packages/<name>/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { sharedConfig } from '@williecubed/vitest-config';
export default defineConfig({ ...sharedConfig });
```

```ts
// apps/<name>/playwright.config.ts
import { defineConfig } from '@playwright/test';
import { sharedConfig } from '@williecubed/playwright-config';
export default defineConfig({
  ...sharedConfig,
  webServer: { command: 'pnpm preview', url: 'http://127.0.0.1:4321' },
  use: { ...sharedConfig.use, baseURL: 'http://127.0.0.1:4321' },
});
```

Start browser-health monitoring before navigation and assert after the expected interactions. The
assertion reports console errors, uncaught page errors, and failed network requests together:

```ts
import { monitorPageHealth } from '@williecubed/playwright-config/page-health';

const health = monitorPageHealth(page);
await page.goto('/');
health.assertNoErrors();
```

A test for a page that should return an error status names the status it expects. The browser still
logs that document's response as a console error; the monitor leaves that one out and reports every
other failure:

```ts
const health = monitorPageHealth(page, { expectedDocumentStatus: 404 });
await page.goto('/nowhere');
health.assertNoErrors();
```

```js
// prettier.config.js (repository root)
import config from '@williecubed/prettier-config';
export default config;
```

A package that needs more than the shared rule adds to it in its own file: spread the ESLint array
and append blocks, spread the Prettier object and add plugins, spread `sharedConfig` and override.
The shared floor stays shared.

## Lint level

The baseline is deliberately strict, because the alternative is three repositories each deciding
what strict means. Findings that exist when a repository adopts it go into
`eslint-suppressions.json` through `eslint --suppress-all`; `cube check debt` then makes sure that
ledger only shrinks, and a file with suppressions has to get better when it is touched.

## The version catalog

`packages/cli/catalog.json` is the pinned version of every tool. Every example's
`pnpm-workspace.yaml` carries the same block, where packages refer to it with `"catalog:"`, and so
does this repository's own. A test fails when any of them disagree.

## Publishing

The packages publish to GitHub Packages under the `@williecubed` scope. See
[Publish a tooling release](../how-to/publish-a-release.md).
