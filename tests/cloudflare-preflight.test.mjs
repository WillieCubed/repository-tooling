import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import { cfAuthFinding } from '../packages/cli/src/lib/operate.mjs';

const cli = path.resolve(import.meta.dirname, '../packages/cli/src/cli.mjs');

const temporary = [];
after(async () => {
  for (const directory of temporary) await rm(directory, { recursive: true, force: true });
});

const whoami = (fields) => `${JSON.stringify(fields, null, 2)}\n`;

test('cf auth whoami passes for a stored cf sign-in', () => {
  const finding = cfAuthFinding(
    whoami({ authenticated: true, authSource: 'OAuth token from config', tokenValid: true }),
  );
  assert.deepEqual(finding, { ok: true, detail: 'cf is signed in' });
});

test('cf auth whoami passes for a CLOUDFLARE_API_TOKEN Cloudflare accepts', () => {
  const finding = cfAuthFinding(
    whoami({
      authenticated: true,
      authSource: 'CLOUDFLARE_API_TOKEN environment variable',
      tokenValid: true,
    }),
  );
  assert.deepEqual(finding, { ok: true, detail: 'cf uses CLOUDFLARE_API_TOKEN' });
});

test('a CLOUDFLARE_API_TOKEN that Cloudflare rejects fails, even though cf found one', () => {
  const finding = cfAuthFinding(
    whoami({
      authenticated: true,
      authSource: 'CLOUDFLARE_API_TOKEN environment variable',
      tokenValid: false,
      accounts: [],
    }),
  );
  assert.equal(finding.ok, false);
  assert.match(finding.detail, /rejects the CLOUDFLARE_API_TOKEN/);
  assert.match(finding.fix, /pnpm exec cf auth login/);
});

test('a stored cf sign-in that Cloudflare rejects fails', () => {
  const finding = cfAuthFinding(
    whoami({ authenticated: true, authSource: 'OAuth token', tokenValid: false }),
  );
  assert.equal(finding.ok, false);
  assert.equal(finding.fix, 'pnpm exec cf auth login --force');
});

test('cf auth whoami exits 0 when signed out, so its JSON decides', () => {
  for (const output of [
    whoami({ authenticated: false, error: 'Not logged in' }),
    'Not logged in\n',
    '',
    undefined,
  ]) {
    const finding = cfAuthFinding(output);
    assert.equal(finding.ok, false, String(output));
    assert.equal(finding.detail, 'cf is not signed in');
    assert.equal(finding.fix, 'pnpm exec cf auth login, or set CLOUDFLARE_API_TOKEN');
  }
});

/**
 * Run `cube preflight` in a repository with the given files, through a pnpm
 * that answers `exec cf auth whoami` and `exec wrangler whoami` with the
 * given output and records nothing else.
 */
async function preflight(contents, { cf = '', wrangler = '' } = {}) {
  const repository = await realpath(await mkdtemp(path.join(tmpdir(), 'cloudflare-preflight-')));
  const bin = await realpath(await mkdtemp(path.join(tmpdir(), 'cloudflare-preflight-bin-')));
  temporary.push(repository, bin);
  const all = { 'package.json': '{ "name": "preflight-fixture", "private": true }\n', ...contents };
  for (const [file, content] of Object.entries(all)) {
    await mkdir(path.dirname(path.join(repository, file)), { recursive: true });
    await writeFile(path.join(repository, file), content);
  }
  await writeFile(path.join(bin, 'cf.out'), cf);
  await writeFile(path.join(bin, 'wrangler.out'), wrangler);
  await writeFile(
    path.join(bin, 'pnpm'),
    [
      '#!/bin/sh',
      `if [ "$1 $2 $3 $4" = "exec cf auth whoami" ]; then cat '${bin}/cf.out'; exit 0; fi`,
      `if [ "$1 $2 $3" = "exec wrangler whoami" ]; then cat '${bin}/wrangler.out'; exit 0; fi`,
      'exit 1',
      '',
    ].join('\n'),
  );
  await chmod(path.join(bin, 'pnpm'), 0o755);
  const result = spawnSync(process.execPath, [cli, 'preflight'], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  // The Cloudflare findings, each failing one followed by its fix line.
  const lines = result.stdout.split('\n');
  return lines.filter(
    (line, index) =>
      /^\s+(ok|FAIL)\s+Cloudflare\b/.test(line) ||
      (/^\s+fix:/.test(line) && /^\s+FAIL\s+Cloudflare\b/.test(lines[index - 1] ?? '')),
  );
}

const signedIn = whoami({
  authenticated: true,
  authSource: 'CLOUDFLARE_API_TOKEN environment variable',
  tokenValid: true,
});

test('preflight checks the cf sign-in for a cf project', async () => {
  const lines = await preflight(
    { 'apps/site/cloudflare.config.ts': 'export default {};\n' },
    { cf: signedIn },
  );
  assert.equal(lines.filter((line) => /Cloudflare/.test(line)).length, 1);
  assert.match(
    lines[0],
    /ok\s+Cloudflare\s+cf uses CLOUDFLARE_API_TOKEN; deployables: apps\/site$/,
  );
});

test('preflight fails a cf project that cf cannot deploy, naming the sign-in', async () => {
  const lines = await preflight(
    { 'apps/site/cloudflare.config.ts': 'export default {};\n' },
    { cf: whoami({ authenticated: false, error: 'Not logged in' }) },
  );
  const index = lines.findIndex((line) => /FAIL\s+Cloudflare\s+cf is not signed in$/.test(line));
  assert.notEqual(index, -1, lines.join('\n'));
  assert.match(lines[index + 1], /fix: pnpm exec cf auth login, or set CLOUDFLARE_API_TOKEN$/);
});

test('a Wrangler sign-in does not stand in for cf in a cf project', async () => {
  const lines = await preflight(
    {
      'apps/site/cloudflare.config.ts': 'export default {};\n',
      'apps/site/wrangler.jsonc': '{}\n',
    },
    { wrangler: 'You are logged in with an OAuth Token.\n' },
  );
  assert.ok(lines.some((line) => /FAIL\s+Cloudflare\s+cf is not signed in$/.test(line)));
  assert.ok(!lines.some((line) => /wrangler/.test(line)), lines.join('\n'));
});

test('preflight checks both tools when a repository has cf and legacy apps', async () => {
  const lines = await preflight(
    {
      'apps/site/cloudflare.config.ts': 'export default {};\n',
      'apps/legacy/wrangler.jsonc': '{}\n',
    },
    { cf: signedIn, wrangler: 'Not authenticated.\n' },
  );
  assert.ok(
    lines.some((line) => /ok\s+Cloudflare\s+cf uses .*deployables: apps\/site$/.test(line)),
  );
  assert.ok(lines.some((line) => /FAIL\s+Cloudflare\s+wrangler is not signed in$/.test(line)));
  assert.ok(lines.some((line) => /fix: pnpm exec wrangler login$/.test(line)));
});

test('preflight passes Cloudflare where nothing deploys', async () => {
  const lines = await preflight({});
  assert.match(lines[0], /ok\s+Cloudflare\s+no cloudflare\.config\.ts or wrangler config/);
});
