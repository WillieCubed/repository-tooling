import assert from 'node:assert/strict';
import test from 'node:test';

import { standard } from '../standard.config.ts';

const playwrightConfig = `${standard.npmScope}/playwright-config`;

test('the Playwright package exposes the organization accessibility assertion', async () => {
  const module = await import(`${playwrightConfig}/accessibility`);
  assert.equal(typeof module.expectNoAccessibilityViolations, 'function');
});

test('the Playwright package reports browser runtime and network failures', async () => {
  const { monitorPageHealth } = await import(`${playwrightConfig}/page-health`);
  const listeners = new Map();
  const page = {
    on(event, listener) {
      listeners.set(event, listener);
    },
  };
  const health = monitorPageHealth(page);

  listeners.get('console')({ type: () => 'error', text: () => 'Uncaught failure' });
  listeners.get('pageerror')(new Error('Render failed'));
  listeners.get('requestfailed')({
    failure: () => ({ errorText: 'net::ERR_FAILED' }),
    method: () => 'GET',
    url: () => 'https://example.test/missing.js',
  });

  assert.throws(
    () => health.assertNoErrors(),
    /console: Uncaught failure[\s\S]*page: Render failed[\s\S]*request: GET https:\/\/example\.test\/missing\.js \(net::ERR_FAILED\)/,
  );
});

function fakePage() {
  const listeners = new Map();
  const mainFrame = {};
  const page = {
    mainFrame: () => mainFrame,
    on(event, listener) {
      listeners.set(event, listener);
    },
  };
  return {
    page,
    childFrame: {},
    mainFrame,
    loadFailure(url, status) {
      listeners.get('console')({
        type: () => 'error',
        text: () =>
          `Failed to load resource: the server responded with a status of ${status} (Not Found)`,
        location: () => ({ url, lineNumber: 0, columnNumber: 0 }),
      });
    },
    response(url, status, { navigation = true, frame = mainFrame } = {}) {
      listeners.get('response')({
        request: () => ({ frame: () => frame, isNavigationRequest: () => navigation }),
        status: () => status,
        url: () => url,
      });
    },
  };
}

test('page health reports the console error for a document that returns 404 by default', async () => {
  const { monitorPageHealth } = await import(`${playwrightConfig}/page-health`);
  const browser = fakePage();
  const health = monitorPageHealth(browser.page);

  browser.response('http://127.0.0.1:4321/nowhere', 404);
  browser.loadFailure('http://127.0.0.1:4321/nowhere', 404);

  assert.throws(() => health.assertNoErrors(), /status of 404/);
});

test('page health accepts the status a test expects the main document to return', async () => {
  const { monitorPageHealth } = await import(`${playwrightConfig}/page-health`);
  const browser = fakePage();
  const health = monitorPageHealth(browser.page, { expectedDocumentStatus: 404 });

  // The console message can arrive before the response event.
  browser.loadFailure('http://127.0.0.1:4321/nowhere', 404);
  browser.response('http://127.0.0.1:4321/nowhere', 404);

  assert.deepEqual(health.errors, []);
  health.assertNoErrors();
});

test('page health still reports failed loads other than the expected document', async () => {
  const { monitorPageHealth } = await import(`${playwrightConfig}/page-health`);
  const browser = fakePage();
  const health = monitorPageHealth(browser.page, { expectedDocumentStatus: 404 });

  browser.response('http://127.0.0.1:4321/nowhere', 404);
  browser.loadFailure('http://127.0.0.1:4321/nowhere', 404);
  browser.response('http://127.0.0.1:4321/missing.png', 404, { navigation: false });
  browser.loadFailure('http://127.0.0.1:4321/missing.png', 404);
  browser.response('http://127.0.0.1:4321/embed', 404, { frame: browser.childFrame });
  browser.loadFailure('http://127.0.0.1:4321/embed', 404);
  browser.response('http://127.0.0.1:4321/broken', 500);
  browser.loadFailure('http://127.0.0.1:4321/broken', 500);

  assert.deepEqual(health.errors, [
    'console: Failed to load resource: the server responded with a status of 404 (Not Found)',
    'console: Failed to load resource: the server responded with a status of 404 (Not Found)',
    'console: Failed to load resource: the server responded with a status of 500 (Not Found)',
  ]);
});

test('the shared Playwright config separates project and platform snapshots', async () => {
  const { sharedConfig } = await import(playwrightConfig);
  assert.equal(
    sharedConfig.snapshotPathTemplate,
    '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}',
  );
});

test('the shared web-server environment keeps framework previews attached to Playwright', async () => {
  const { foregroundServerEnvironment } = await import(playwrightConfig);
  assert.equal(foregroundServerEnvironment.ASTRO_DEV_BACKGROUND, '1');
  assert.equal(foregroundServerEnvironment.ASTRO_PREVIEW_BACKGROUND, '1');
});
