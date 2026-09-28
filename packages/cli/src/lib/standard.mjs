/**
 * The owner values from standard.config.ts at the root of repository-tooling. The CLI runs from a
 * consumer's node_modules, where Node does not strip TypeScript types, so it cannot import that
 * file and carries this copy instead. tests/standard-config.test.mjs fails when the two differ.
 */
export const standard = Object.freeze({
  owner: 'WillieCubed',
  npmScope: '@williecubed',
  cliName: 'cube',
  stateDir: '.williecubed',
  pluginName: 'willie-contributions',
  bot: Object.freeze({ name: 'cube-bot', email: 'noreply@willie.page' }),
  cloudflare: Object.freeze({
    accountId: '18f90fa11cf0a87145be4a1517e41217',
    accessTeam: 'williecubed',
    zone: 'willie.page',
  }),
});

/** The repository's own list of durable commit scopes. */
export const commitScopes = `${standard.stateDir}/commit-scopes.txt`;

/** repository-tooling on GitHub, as `owner/name`. */
export const sourceRepository = `${standard.owner}/repository-tooling`;

/** The environment variable a non-interactive run reads the Cloudflare setup token from. */
export const setupTokenVariable = `${standard.cliName.toUpperCase()}_CLOUDFLARE_SETUP_TOKEN`;

/** The Access team domain: where Access signs tokens and where Google redirects to. */
export const accessTeamDomain = `${standard.cloudflare.accessTeam}.cloudflareaccess.com`;
