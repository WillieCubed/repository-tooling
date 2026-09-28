import type { Page } from '@playwright/test';

export interface PageHealthOptions {
  /**
   * The HTTP status the test expects the main document to return, such as 404 for a not-found
   * page. The browser's console error for that document is not reported; every other failure is.
   */
  expectedDocumentStatus?: number;
}

export interface PageHealthMonitor {
  readonly errors: readonly string[];
  assertNoErrors(): void;
}

export declare function monitorPageHealth(
  page: Page,
  options?: PageHealthOptions,
): PageHealthMonitor;
