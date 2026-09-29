# Identity

How every web project shows that Willie made it, and what each project may change about how it
looks. willie.page is the publisher of every project. Each project carries one small link back to it
in the page's chrome, and the work itself (a deck, a report cover, a slide, an app screen) stays
free.

Identity has two layers. The constant layer is the mark, the author link, and the link's
machine-readable twin. A project installs these from `@williecubed/brand` and does not edit them.
The free layer is type, color, layout, and voice, and the project owns it.

## The author link

Every page a visitor reaches without an admin sign-in has one link to `https://willie.page/` whose
text is "Willie Chalmers III" and whose `rel` includes `author`.

| Form   | Use                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------- |
| Lockup | The default: the tiled mark followed by "Willie Chalmers III"                                             |
| Prose  | His name linked inside the project's own sentence, such as WPP's "Hey, it's Willie.", with `rel="author"` |

The text is the name because a visitor's question is who made the page. It matches willie.page's own
`og:site_name`. "Made with ❤️", "Powered by", and a bare "willie.page" are not used.

### Placement

| Page type                | Placement                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Site page                | Last line of the footer, start-aligned                                                              |
| Guest page               | The page footer                                                                                     |
| Deck viewed by one guest | Below the presentation frame, never on a slide                                                      |
| App                      | Footer of home, sign-in, and account pages; never inside a focus mode such as a rehearsal           |
| Audience screen          | The control corner, beside fullscreen, shown with the other controls                                |
| Report                   | Shelf: the end of the masthead row. Report page: the nav row beside "All reports". Never on a cover |
| 404                      | Where the project's other pages put it                                                              |
| Admin                    | Not required                                                                                        |

On an audience screen the link stays in the DOM. It appears when the pointer moves or the link takes
keyboard focus, hides after 3 seconds without movement, and opens in a new tab so the screen keeps
running. A click-anywhere-to-advance handler ignores clicks on links.

### Appearance

- **Mark:** the tiled mark from the willie.page kit, at 1.25em and never under 16 px. The tile
  carries its own ground, so it reads on any background without recoloring.
- **Name:** the host page's font and color (`font: inherit; color: currentColor`), weight 600, at
  the host's small text size and never under 14 px.
- **Target:** 0.5em between mark and name, and a hit area of at least 24 by 24 CSS px
  ([WCAG 2.2 SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)).
- **States:** a 2 px underline at a 4 px offset on hover, and a 2 px `currentColor` focus ring at a
  4 px offset. No color change and no motion; the animated cube belongs to willie.page alone.

### Machine-readable identity

- Every page's head has `<link rel="author" href="https://willie.page/">`, the same tag willie.page
  emits for itself.
- The visible link is `<a class="h-card" rel="author" href="https://willie.page/">`, placed outside
  any `article`, because an `a` with `rel="author"` names the author of its nearest `article`
  ([HTML Standard](https://html.spec.whatwg.org/multipage/links.html#link-type-author)). A parser
  that follows it reaches willie.page's representative h-card
  ([IndieWeb authorship](https://indieweb.org/authorship-spec)).
- A public, indexed home page adds JSON-LD `WebSite` whose `author` is
  `{"@type": "Person", "@id": "https://willie.page/#person", "name": "Willie Chalmers III", "url": "https://willie.page/"}`,
  the `@id` willie.page's own graph uses. Unlisted sites skip it.
- `og:site_name` is the project's own name, such as "Willie's PowerPoint Party".
- Projects never use `rel="me"`. It says a page is Willie, and it stays reserved for his profiles on
  willie.page. Each of those profiles points back at `https://willie.page/`.
- The link carries no query parameters.

## `@williecubed/brand`

Projects get the mark, the author link, and willie.page's color tokens from `@williecubed/brand`,
pinned like every other `@williecubed/*` package, and never copy them. It is published from the
website repository, beside the build that generates the kit, as recorded in
[Publish the brand package from willie.page](../explanation/decisions/brand-from-website.md).

| Export                               | For                                                                   |
| ------------------------------------ | --------------------------------------------------------------------- |
| `AuthorLink.astro`, `AuthorLink.tsx` | The visible link, with an `audience` option for the reveal behavior   |
| `AuthorHead.astro`, `authorHead()`   | The head link, and the home-page JSON-LD                              |
| `authorLinkHtml`                     | Pages generated outside a framework, such as an offline page          |
| `CubeMark.astro`, `CubeMark.tsx`     | The mark in the kit's variants, including a bare cube for under 32 px |
| `tokens.css`                         | willie.page's colors in both schemes                                  |

It has no runtime dependencies. A project never loads the mark from willie.page at runtime: a
willie.page outage would break every project, and strict content security policies allow images from
the project's own origin only.

## Verification

- `cube check pages <dir>` reads every built `.html` file in an app's output. It fails when a page
  lacks the head link or a visible `a[rel~="author"][href="https://willie.page/"]` with text outside
  any `article`, or lacks the head floor below. It runs as the app's `validate` task after `build`.
- `pnpm preflight --production` fetches the production home page and a missing path and applies the
  same test, which covers pages rendered on demand.
- The templates put `AuthorLink` and `AuthorHead` in their base layout, so a new project passes on
  its first commit.

## Head floor

Every page has a title, a description, a canonical URL or `noindex`, `favicon.svg`, and the author
head link. Every page whose link is sent to people, indexed or not, also has `og:title`,
`og:site_name`, and a 1200 by 630 `og:image`, because a link pasted into a message is judged by its
preview.

## The free layer

A project chooses its own type, palette, layout, favicon art, social image, 404 voice, motion, and
dark mode.

- A project that wants willie.page's colors imports `@williecubed/brand/tokens.css`.
- A project with no mark of its own uses the kit's tiled mark as its favicon. An installable site,
  or one opened mostly from messages on phones, also ships a 180 by 180 `apple-touch-icon.png` and a
  web app manifest.
- A 404 page answers with status 404, is `noindex`, says plainly that nothing is at the address,
  links to the project's front page, and carries the author link. Its voice is the project's own.
- A subdomain is the word people say, not the repository name: `party`, not `wpp`.

## Deliberate departures

A project departs from the free layer without asking. The constant layer gives way only inside the
work itself: a report cover, a slide, a deck frame. There, a project shows its own identity line or
nothing. The chrome around the work (nav, footer, shelf, control corner) keeps the constant layer.

## Links from willie.page

willie.page lists a project by adding an entry to its own content, and lists only projects meant to
be found. No project reads that list, and nothing collects it automatically. Unlisted projects are
never listed.
