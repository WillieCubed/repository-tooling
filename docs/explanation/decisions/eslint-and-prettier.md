# ESLint and Prettier

Decided 2026-09-28.

## Decision

Lint with ESLint and typescript-eslint, and format with Prettier, starting from LVBT's strict shared
config and adding `eslint-plugin-astro`, `eslint-plugin-mdx`, and `prettier-plugin-astro`.
TypeScript stays on version 6.

## Requirements that decided it

- Astro and MDX files must be linted and formatted, including Astro templates.
- Type-aware rules must catch floating and misused promises and non-exhaustive switches as errors.
- Markdown must be formatted, because the documentation standard wraps prose.

## Comparison, September 2026

| Requirement              | ESLint and Prettier  | Biome 2                     | Oxlint and Oxfmt                 |
| ------------------------ | -------------------- | --------------------------- | -------------------------------- |
| Astro templates          | Linted and formatted | Experimental, opt-in        | Frontmatter and scripts only     |
| MDX                      | Linted and formatted | Not supported               | Formatted, not linted            |
| Promise and switch rules | Stable               | Nursery                     | 59 of 61 typescript-eslint rules |
| TypeScript 7             | Not yet supported    | Own type inference          | Required for type-aware rules    |
| Markdown formatting      | Yes                  | In development              | Yes                              |
| Speed                    | Slowest              | About 10 to 25 times faster | Fastest                          |

Sources: [Astro editor setup](https://docs.astro.build/en/editor-setup/),
[Biome language support](https://biomejs.dev/internals/language-support/),
[Biome rules](https://biomejs.dev/linter/javascript/rules/),
[Oxlint type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware.html),
[Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html),
[Oxc Astro support](https://github.com/oxc-project/oxc/issues/19273).

## Rejected

- **Biome**, which WPP and putin used. Its promise rules are still in nursery, it does not support
  MDX, and its Astro support is experimental.
- **Oxlint and Oxfmt.** It is the fastest option and the only type-aware linter on TypeScript 7, but
  it cannot lint Astro templates or MDX yet.
- **A hybrid of Oxlint for TypeScript and ESLint for Astro and MDX.** Two linter configs would have
  to agree on every rule, and the standard would carry both.

## Revisit

Revisit when both are true: Oxlint lints Astro templates and MDX, and typescript-eslint supports
TypeScript 7.1 or later. At that point, compare again with the same requirements.
