/**
 * Every value that ties this repository's tooling to one owner. The standards scripts, the tests,
 * and the CLI read these instead of spelling them out, so changing an owner means changing this
 * file. docs/reference/standard-config.md describes each key.
 *
 * The CLI and its contribution plugin run from a consumer's node_modules, where Node does not
 * strip TypeScript types, so they carry their own copies: packages/cli/src/lib/standard.mjs, and
 * the literal values in shell hooks, JSON, YAML, and Markdown. A test fails when any copy differs
 * from this file.
 */
export interface StandardConfig {
  /** GitHub owner of this repository and every consumer. */
  readonly owner: string;
  /** Package scope, and the scope of the GitHub Packages registry. */
  readonly npmScope: `@${string}`;
  /** The command every repository's scripts call. */
  readonly cliName: string;
  /** Where every repository keeps the standard's per-repository files, relative to its root. */
  readonly stateDir: string;
  /** The Claude Code and Codex contribution plugin. */
  readonly pluginName: string;
  /** The identity the update workflow commits as. */
  readonly bot: { readonly name: string; readonly email: string };
  /** Defaults a template writes into a new project's platform.json. */
  readonly cloudflare: {
    readonly accountId: string;
    readonly accessTeam: string;
    readonly zone: string;
  };
}

export const standard = {
  owner: 'WillieCubed',
  npmScope: '@williecubed',
  cliName: 'cube',
  stateDir: '.williecubed',
  pluginName: 'willie-contributions',
  bot: { name: 'cube-bot', email: 'noreply@willie.page' },
  cloudflare: {
    accountId: '18f90fa11cf0a87145be4a1517e41217',
    accessTeam: 'williecubed',
    zone: 'willie.page',
  },
} as const satisfies StandardConfig;

/** The repository's own list of durable commit scopes. */
export const commitScopes = `${standard.stateDir}/commit-scopes.txt`;

/** This repository on GitHub, as `owner/name`. */
export const sourceRepository = `${standard.owner}/repository-tooling`;

/** The Claude Code marketplace every repository loads the contribution plugin from. */
export const marketplace = standard.cliName;

/** The environment variable a non-interactive run reads the Cloudflare setup token from. */
export const setupTokenVariable = `${standard.cliName.toUpperCase()}_CLOUDFLARE_SETUP_TOKEN`;
