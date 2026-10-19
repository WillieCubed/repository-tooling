# Personal web apps

New personal web apps ship as responsive, installable progressive web apps (PWAs). The baseline
includes a manifest, app icons, a service worker, a deliberate offline experience, and verification
in an installed browser app. It is a review rule; the standard does not yet generate or enforce it.

## Scope

This default covers personal web apps governed by this repository standard. It does not extend to
organization or client projects merely because the same maintainer works on them. Libraries, CLIs,
and services without a browser interface do not need a PWA shell. An exception records its reason,
owner, and revisit condition in the app's architecture documentation.

Existing apps adopt the baseline during a substantial interface change, a deployment change that
affects the app shell, or work on installation or offline behavior. A small unrelated fix does not
require a retrofit. This document establishes the default; it does not certify existing apps or
claim that they have all migrated. Package and example changes follow the standard's release rules.

## App identity

Every app page links to one valid web app manifest. The manifest has a stable `id`, a meaningful
`name` and `short_name`, a `start_url` inside its explicit `scope`, and `display: standalone`.
Identity and launch URLs stay free of credentials, one-time tokens, and tracking parameters. An app
under a subpath uses that subpath consistently; origin-root values are not copied blindly.

`theme_color` and `background_color` come from the app's own theme and match its launch surface. The
page's theme-color metadata agrees with that choice and its supported color schemes. A theme change
must not produce an unrelated flash during launch.

The manifest declares real, fetchable PNG icons at 192 × 192 and 512 × 512 pixels with purpose
`any`, plus maskable icons at those sizes with purpose `maskable`. Maskable artwork has an opaque
background and keeps essential content inside the central circle whose radius is 40% of the image
width. Each page also links a 180 × 180 pixel Apple touch icon. Tests verify declared dimensions,
paths, purposes, and theme values; visual inspection checks cropping and legibility.

The personal website is a reference for identity and visual continuity: its `app/manifest.ts` uses
stable root identity and launch URLs, standalone display, theme-derived colors, and regular and
maskable PNG icons. Its layout declares an Apple touch icon, its design principles emphasize
responsive layouts and reduced motion, and `tests/unit/web-manifest.test.mts` checks theme values
and icon files. Those checks alone do not establish service worker or offline support.

## Service worker and updates

Production serves the app over HTTPS. Localhost is suitable for development checks. Registration is
feature-detected and uses the app's deployment base path. The worker's URL and registration scope
cover intended app routes without taking control of neighboring apps. The worker script returns
JavaScript with the correct content type, rather than an HTML fallback or redirect.

Each app documents its worker's registration, cache names and versions, allowlisted routes, offline
strategy, and update behavior in its architecture and operations documentation. A build integrates
the worker with its own assets; no framework or PWA dependency is mandated by this rule.

An update installs a complete asset set before activation. Cache cleanup removes only obsolete
caches owned by that app. Stable worker URLs and appropriate HTTP revalidation allow new releases to
be discovered. The lifecycle supports both a fresh installation and a client already controlled by
the previous worker.

A waiting worker activates when existing clients close, or after an explicit update action at a safe
point. `skipWaiting`, `clients.claim`, and reload handlers require a deliberate policy. Updates
never interrupt a form, authentication flow, or unfinished task, and never create a reload loop. A
failed installation leaves the last working version usable. Rollback includes the worker and its
cache compatibility, not only the server bundle.

## Offline behavior and data boundaries

Every app chooses the smallest useful offline strategy. A public content app can cache selected
public pages; an interactive app can cache a public shell and show that live work needs a
connection. A truthful offline fallback is sufficient when the task depends on a server. Full data
replication and background synchronization are not baseline requirements.

The cache policy allowlists same-origin public assets and any explicitly reviewed public `GET`
responses. It checks the request method, URL, response status, and response type before storage. It
excludes authentication and logout routes, account and admin pages, authenticated or private
responses, credentials, OTPs, token-bearing URLs, mutation endpoints, and third-party responses. A
broad navigation fallback never turns an authentication failure or API error into a successful
app-shell response. HTTP cache headers do not substitute for an explicit Cache Storage policy.

Writes remain network-only. Offline submissions fail visibly, preserve safe in-memory input where
useful, and offer an intentional retry after reconnection. The app never silently queues or replays
writes. Any future offline-write feature needs its own documented consent, retention, conflict,
retry, and deduplication design before implementation.

Cached content is labeled when its age or freshness matters. Offline status appears only when it
helps explain unavailable work; browser connectivity hints alone never prove that the server is
reachable. An app never reports a failed save as successful or promises offline capabilities it has
not tested. Reconnection restores live behavior without repeated banners or forced reloads.

## Responsive and standalone behavior

The app remains usable in a browser tab and in standalone display at viewport widths of 320, 390,
768, and 1440 CSS pixels. Layout follows content rather than fixed device heights. At 200% zoom,
text and essential controls remain available without clipped content. Small layouts reflow without
unnecessary horizontal scrolling.

Standalone views account for safe-area insets, display cutouts, changing viewport height, and the
on-screen keyboard. Focused inputs and their actions stay reachable when the keyboard opens.
Navigation has a usable path back without relying on browser chrome. External links and out-of-scope
destinations behave intentionally.

Keyboard navigation, visible focus, accessible control names, and touch targets remain usable. No
essential action depends on hover. Reduced-motion preferences remove unnecessary animation without
hiding state changes. App identity and launch colors remain legible in supported themes.

## Acceptance evidence

The [personal web app checklist](../how-to/verify-a-personal-web-app.md) records the app's baseline
and retrofit review. Automated tests cover manifest assets and cache-policy exclusions where
applicable. A successful build, manifest inspection, or Lighthouse score alone does not prove an
installed app works. Acceptance records the tested URL and revision, date, operating system and
browser versions, screenshots or recordings, observed results, and any untested platform.

## Browser references

Browser installation support and menu labels vary. These references describe platform behavior; the
requirements above are the personal standard's own baseline.

- [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN: Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [web.dev: Updating a PWA](https://web.dev/learn/pwa/update)
- [web.dev: Maskable icons](https://web.dev/learn/pwa/web-app-manifest#maskable_icons)
