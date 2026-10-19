# Personal web app verification

Use this checklist for a new personal web app or a scoped retrofit. The
[personal web app standard](../reference/personal-web-apps.md) defines the baseline. Record observed
results in the app's own documentation or pull request; unchecked items remain open work.

## Scope and offline decision

- [ ] Record whether this is a new app or a retrofit, the routes in scope, and any exception with
      its reason, owner, and revisit condition. Preserve organization and client project boundaries.
- [ ] Describe the useful offline experience, public cache allowlist, expiry and cleanup, update
      policy, and the work that requires a connection.
- [ ] Confirm that private responses, authentication, OTPs, token URLs, mutations, and third-party
      responses bypass worker storage. Confirm that writes are never silently queued or replayed.

## Build and browser inspection

- [ ] Run the app's checks and production build. Serve that build over HTTPS or localhost, including
      its deployment subpath. Verify that each page links the intended manifest.
- [ ] Inspect the parsed manifest and fetched icons in browser developer tools. Check stable `id`,
      launch URL and scope, standalone display, theme colors, PNG 192 and 512 icons, maskable safe
      zones, and the 180 pixel Apple touch icon. Check actual dimensions and visual cropping.
- [ ] Inspect worker registration, script response and scope. After first load and the expected
      lifecycle transition, confirm that the intended pages have the expected controller.
- [ ] Check Cache Storage after browsing public and authenticated routes. Verify that only the
      documented public resources enter app-owned caches. Exercise excluded requests and failed
      responses; automated policy tests supplement this browser evidence.

## Installation and layout

- [ ] On desktop Chromium, install using the browser's install control or menu, launch from the
      operating system, and verify the icon, name, launch route, and standalone window.
- [ ] On Android Chrome, open the deployed URL, use the browser menu's install or Add to Home screen
      action, complete installation, and launch from the launcher. Verify standalone display and app
      navigation. Record whether the browser installed an app or created a shortcut.
- [ ] On iPhone or iPad Safari, open the deployed URL, open Share, choose Add to Home Screen, enable
      Open as Web App if offered, and add it. Launch from the Home Screen and verify the Apple icon,
      launch surface, standalone navigation, safe areas, and keyboard behavior.
- [ ] Check browser and standalone layouts at widths of 320, 390, 768, and 1440 CSS pixels, plus
      200% zoom. Check scrolling, navigation, touch, keyboard focus, input visibility with the
      on-screen keyboard open, supported themes, and reduced motion.

## Failure and update behavior

- [ ] After a controlled online visit, go offline and relaunch. Test the launch route, a visited
      route, an unvisited route, and a direct deep link. Verify useful cached content or a truthful
      fallback instead of a blank screen, misleading success, or endless loading.
- [ ] Try a server-dependent action offline. Verify clear failure, deliberate retry, and no queued
      write when connectivity returns. Check recovery from a server error while the device is online
      as well as loss of connectivity.
- [ ] Restore the connection and confirm live work recovers without stale status or reload loops.
- [ ] Install version A, keep a client open with unfinished input, and deploy version B. Verify the
      waiting-worker policy, safe activation, cache cleanup, and version consistency after relaunch.
      Exercise an interrupted worker installation and the documented rollback path.

## Verification record

Record the revision, deployment URL, date, browser and OS versions, device or emulated viewport,
results, and screenshots or recordings. Identify device checks separately from emulation. If a
platform is unavailable, record it as untested and name the remaining verification; do not infer
Android or iOS installation from a desktop run. A retrofit record names the app actually updated and
does not imply that other existing apps meet the baseline.
