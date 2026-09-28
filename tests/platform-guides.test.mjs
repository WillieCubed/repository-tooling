import assert from 'node:assert/strict';
import test from 'node:test';

import {
  accessAppGuide,
  googleGroupGuide,
  googleWorkspaceGuide,
  hostnameParts,
  relativeName,
  resendDomainGuide,
  setupTokenGuide,
  teamDomainGuide,
  turnstileGuide,
  zeroTrustGuide,
} from '../packages/cli/src/lib/platform/guides.mjs';
import { standard } from '../standard.config.ts';
import { sampleManifest } from './support/platform.mjs';

/**
 * The dashboard guides are read by someone who has never used the service,
 * so the values they must type are checked here: addresses built from the
 * team domain, hostnames split the way the form asks, DNS names relative to
 * the zone.
 */

const everyStep = (guide) => guide.steps.join('\n');

const teamDomain = `${standard.cloudflare.accessTeam}.cloudflareaccess.com`;

test('the Google sign-in guide gives the exact origin and redirect for the team domain', () => {
  const steps = everyStep(googleWorkspaceGuide('team.cloudflareaccess.com', 'example.org'));
  assert.match(steps, /exactly https:\/\/team\.cloudflareaccess\.com$/m);
  assert.ok(steps.includes('https://team.cloudflareaccess.com/cdn-cgi/access/callback'));
  assert.ok(steps.includes('example.org'));
});

test("the Google sign-in guide defaults to the owner's team domain", () => {
  const steps = everyStep(googleWorkspaceGuide(undefined, 'example.org'));
  assert.match(steps, new RegExp(`exactly https://${teamDomain.replaceAll('.', '\\.')}$`, 'm'));
});

test('the team domain and the team name are never confused', () => {
  const guides = [zeroTrustGuide(sampleManifest()), teamDomainGuide('ACCESS_TEAM_DOMAIN')];
  for (const guide of guides) {
    const steps = everyStep(guide);
    assert.ok(steps.includes(teamDomain));
    // The team name is only a label, so no address is ever built from it.
    assert.ok(!steps.includes(`${standard.owner}.cloudflareaccess.com`));
  }
  assert.match(everyStep(teamDomainGuide('ACCESS_TEAM_DOMAIN')), /Overview.*Account details/);
});

test('each Access destination is split into the subdomain, domain, and path the form asks for', () => {
  assert.deepEqual(hostnameParts('willie.page/api/admin/*', 'willie.page'), {
    subdomain: '',
    domain: 'willie.page',
    path: 'api/admin/*',
  });
  assert.deepEqual(hostnameParts('party.willie.page', 'willie.page'), {
    subdomain: 'party',
    domain: 'willie.page',
    path: '',
  });
});

test('the Access guide walks through creating the application and ends with the audience tag', () => {
  const app = sampleManifest().access[0];
  const guide = accessAppGuide(app, 'example.org');
  const steps = everyStep(guide);
  assert.ok(steps.includes(app.allow.googleGroup));
  assert.ok(steps.includes('Path admin/*'));
  assert.ok(guide.steps.at(-1).includes(app.audienceSecret));
  assert.ok(guide.audienceSteps.every((step) => guide.steps.includes(step)));
});

test('email records are named relative to the zone, including for a sending subdomain', () => {
  assert.equal(relativeName('send.notify.example.org', 'example.org'), 'send.notify');
  const cloudflare = sampleManifest().cloudflare;
  const steps = everyStep(resendDomainGuide({ domain: 'notify.example.org' }, cloudflare));
  assert.ok(steps.includes('name send.notify'));
  assert.ok(steps.includes('name resend._domainkey.notify'));
  assert.ok(steps.includes('us-east-1'));
});

/** Each "copy" and "paste" in the order a person reads them, skipping "do not copy". */
function clipboardUses(steps) {
  return steps
    .join('\n')
    .replace(/\bdo not copy\b/gi, '')
    .matchAll(/\b(copy|paste)\b/gi)
    .map(([word]) => word.toLowerCase())
    .toArray();
}

test('no guide asks for a second copy before the first one is pasted', () => {
  const manifest = sampleManifest();
  const [app] = manifest.access;
  const [widget] = manifest.turnstile;
  const access = accessAppGuide(app, 'example.org');
  const turnstile = turnstileGuide(widget, manifest.cloudflare, 'apps/site/wrangler.jsonc');
  const guides = {
    access: access.steps,
    'access, made by hand': access.manualSteps,
    'access, tag only': access.audienceSteps,
    turnstile: turnstile.steps,
    'turnstile, made by hand': turnstile.manualSteps,
    'turnstile, secret only': turnstile.secretSteps,
    'google workspace': googleWorkspaceGuide('team.cloudflareaccess.com', 'example.org').steps,
    'team domain': teamDomainGuide('ACCESS_TEAM_DOMAIN').steps,
    'setup token': setupTokenGuide(manifest).steps,
    'google group': googleGroupGuide(app.allow.googleGroup, [app]).steps,
    resend: resendDomainGuide(manifest.email[0], manifest.cloudflare).steps,
    'zero trust': zeroTrustGuide(manifest).steps,
  };
  for (const [name, steps] of Object.entries(guides)) {
    const uses = clipboardUses(steps);
    uses.forEach((use, index) => {
      if (use === 'copy' && index > 0)
        assert.equal(uses[index - 1], 'paste', `${name}: a copy follows an unpasted copy`);
    });
    if (uses.length > 0)
      assert.equal(uses.at(-1), 'paste', `${name}: the last copy is never pasted`);
  }
});
