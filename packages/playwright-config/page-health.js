const loadFailure = /^Failed to load resource: the server responded with a status of (\d+)\b/;

/**
 * Record browser failures during a Playwright test. Start monitoring before
 * navigation, then assert after the page's expected interactions finish.
 *
 * A test that expects the page itself to return an error status, such as a
 * 404 page, passes `expectedDocumentStatus`: the browser's console error for
 * that main-frame document is then not reported. Every other failed load is.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ expectedDocumentStatus?: number }} [options]
 */
export function monitorPageHealth(page, { expectedDocumentStatus } = {}) {
  const reports = [];
  const expectedDocuments = new Set();

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const report = { error: `console: ${message.text()}` };
    const status = loadFailure.exec(message.text())?.[1];
    if (Number(status) === expectedDocumentStatus) report.document = message.location().url;
    reports.push(report);
  });
  page.on('pageerror', (error) => {
    reports.push({ error: `page: ${error.message}` });
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    reports.push({
      error: `request: ${request.method()} ${request.url()} (${failure?.errorText ?? 'unknown failure'})`,
    });
  });
  page.on('response', (response) => {
    if (response.status() !== expectedDocumentStatus) return;
    const request = response.request();
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      expectedDocuments.add(response.url());
    }
  });

  // Filtered on read: the console message and the response event arrive in either order.
  const errors = () =>
    reports.filter((report) => !expectedDocuments.has(report.document)).map(({ error }) => error);

  return {
    get errors() {
      return errors();
    },
    assertNoErrors() {
      const current = errors();
      if (current.length > 0) throw new Error(`Browser health failures:\n\n${current.join('\n')}`);
    },
  };
}
