export const siteName = 'Example site';

/** The document title: the page name, then the site, or just the site on the home page. */
export function pageTitle(page?: string): string {
  return page === undefined ? siteName : `${page} · ${siteName}`;
}
