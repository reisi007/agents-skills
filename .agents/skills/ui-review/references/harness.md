# Scaffolding the UI-review screenshot harness in any web project

Generic instructions to bring up the harness in a web project (React/Vue/… with
Playwright). Copyable starting points live in `references/templates/`.

## 1. Dedicated Playwright config

Create `playwright.screenshots.config.ts` next to the standard
`playwright.config.ts`. It must be a **separate** config so the screenshot set
never runs inside the normal E2E suite:

- `testDir` points at a dedicated folder (e.g. `./tests/screenshots`).
- Own `outputDir` for artifacts (e.g. `test-results/ui-screenshots`) — Playwright cleans this directory at the start of every run, wiping the whole tree including subdirectories it did not create, so never park anything else inside it.
- Same browser projects as the standard config (desktop + mobile viewport) so
  the set reviews both form factors.
- `baseURL` pointing at the local dev server.
- **Do NOT** import or extend the standard config.

Template: `templates/playwright.screenshots.config.ts.example`

## 2. Route/state manifest

Create a typed manifest (e.g. `tests/screenshots/ui-review.config.ts`) exporting:

- A `UiReviewRoute` interface: `name`, `path` (may contain `:params`), `states`
  (`'filled' | 'empty'`), optional `auth` (`'guest' | 'admin' | 'user' | 'none'`),
  optional `viewports` (`'desktop' | 'mobile'`), optional `note`, required
  `expectedTitle` (the app's static `<title>`),
  optional `tenant` (tenant key per state; omitted states use the primary origin), optional
  `seeds` (resolves dynamic ids/credentials from seeded data at runtime),
  optional `mobileDirectLoadReason` (documents why the mobile viewport must
  load a route directly instead of using its header navigation),
  optional `leadingSections` / `trailingSections` (positive per-route sampling
  windows; see "Sections" below), optional `scrollContainerSelector` (CSS
  selector for that route's intended inner scroller), optional
  `waitForContentReady(page)` (an app-specific promise for lazy content), and
  optional `nav` steps describing how the spec reaches the route via UI clicks
  (or a justified direct-URL load).
- A `routes` array covering the app's page matrix.
- Project configuration for `primaryOrigin`, optional named `tenants` (each with
  an `origin` and optional idempotent `prepare` callback), and optionally a
  shared `scrollContainerSelector`, plus `viewportSizes` keyed by the `desktop`
  and `mobile` labels. These exact dimensions must match the Playwright projects;
  the harness resolves labels from `page.viewportSize()`, never project names,
  and fails on an unmatched or ambiguous size. Coverage JSON includes the actual
  width and height.

For a single-tenant app, leave `tenant` unset and use `primaryOrigin`; no fixture
tenant or setup callback is required. Configure only additional tenants the app
needs, and select them from a route's `tenant` map.

The manifest is the single place to add/remove routes. The generic spec reads
it — adding a route is a manifest edit only.

Template: `templates/ui-review-manifest.ts.example`

## 3. Generic manifest-driven spec

Create `tests/screenshots/ui-screenshots.spec.ts`. For every route × state ×
viewport it:

1. seeds deterministic data (filled states) via the route's per-state `seeds`,
2. logs in through the UI when the route requires auth (the login page itself
   is reached by a justified direct URL — route-guard/deep-link semantics; a
   real mobile user cannot always reach a login button that overflows the
   header),
3. navigates via the route's `nav` steps (UI clicks; `page.goto` only for
   justified direct-URL/deep-link routes — document why in the manifest). On
   mobile, a route with banner-click nav steps loads directly only when it sets
   `mobileDirectLoadReason`; otherwise its UI nav steps still run,
4. waits for the page to settle (network idle + key UI) **after login the
   auth redirect chain must finish before any nav step runs** (a regular user
   lands on `/`, an admin on `/admin/*`),
5. saves viewport-height section PNGs `<name>-secN.png` for the **sampled**
   sections — page top plus the current end candidate (confirmed as a footer
   only with the readiness hook below) — and a full-page PNG
   `<name>.png` only for **short window-scrolling** pages.

Screenshot path resolution: **`page.screenshot({ path })` resolves relative
paths against the process working directory, not the config `outputDir`** — build
the path with `path.resolve(process.cwd(), outputDir, state, viewport, name)`.

### Sections: why the capture is sampled, not exhaustive

A full-page PNG of a long page is **downscaled to ~2000 px** when the vision
model reads it (`media.auto_resize` default). On mobile a 12,000-px-tall page
collapses to ~180 px width — everything below the fold is unreadable and real
bugs there are missed (a clipped badge in a table far down a page was found by a
human, not the review). So the spec instead:

- scrolls the **real scroll container** in 80 %-viewport steps (20 % overlap) and
  saves `<name>-secN.png` for each sampled position;
- honors the route-level or app-wide `scrollContainerSelector` first. Without a
  selector, it prefers a visible, vertically scrollable inner element (largest
  visible area, then greatest scroll range) before falling back to the window;
  this avoids choosing the document just because it has incidental overflow.
  The heuristic is generic, but a selector is the reliable choice when an app
  has multiple possible scrollers or a nonstandard layout;
- **samples** scroll positions instead of storing all of them: only the first
  `leadingSections` screens (default 4, the page top) and the last
  `trailingSections` screens (default 2, the footer) are written, the bulk in
  between — typically the image gallery — deliberately not. Both windows are
  manifest options per route, so a route whose value sits further down can widen
  its top window. When the windows overlap, each section is captured only once.
- writes a **full-page PNG only for short window-scrolling pages** (at most
  `FULL_PAGE_MAX_SECTIONS`, 8 scroll positions). Short pages capture every
  section as well as the overview; longer pages get no overview. For an inner
  overflow scroller, the sections still capture the content but a page-level
  `fullPage` screenshot would omit the scroller's offscreen content, so no
  overview is written. Each route/state/viewport `.json` records `sections`
  (total scroll positions), `capturedSectionIndexes`, `capturedSections` (index
  and scroll offset for each saved section), `footerSectionIndex`, and
  `fullPageOverview` (whether the full-page PNG was written), so the coverage
  statement stays checkable. `scrollContainer` records the selected kind and
  selector, and each captured offset records the actual scroll position reached.
  The sampler rechecks the live range at the end, so lazy-loaded growth shifts the
  trailing captures and reported range together; if the range will not stabilize,
  capture fails rather than writing stale coverage. After each screenshot it
  rechecks both range and actual scroll offset; a mismatch retries the capture
  and ultimately fails rather than recording the requested offset as if it were
  reached. It forces `scroll-behavior: auto` during capture and removes the
  temporary override afterward; after each scroll it waits 150 ms plus an
  animation frame before checking the actual offset. To claim a settled footer,
  configure `waitForContentReady(page)` to
  wait for the app's real lazy-content completion signal (for example, a loading
  indicator to disappear or the expected item count to render); it runs after
  scrolling to capture positions and while settling at the live end. A timeout
  alone is not a readiness signal. Without this hook, `footerReady` is `false`
  and `footerSectionIndex` is `null`, even if a screenshot was taken at the
  current end. With it, the footer index is reported only when the final sampled
  section's actual offset reached the settled end.

The point of the sampling is a review **budget**: the top and confirmed footer
carry the review value, the gallery in between is bulk (an unbounded run produced
~1900 PNGs / 1.5 GB). Sampling reduces file count, never the honesty of the
coverage statement — every non-sampled screen is explicitly not looked at, and
`secN` indexes are therefore **not contiguous** (with the default
`leadingSections: 4`, `sec0`…`sec3`, then the end candidate (e.g. `sec90`, `sec91`).

The manifest requires the app's static `<title>` (`expectedTitle`), which the spec
asserts before capturing. This guard is mandatory so a foreign dev-server on the
port is never silently screenshotted.

Tag every test (e.g. `{ tag: ['@screenshot'] }`) so it is groupable and clearly
separate from functional E2E tags.

### Login budget (if the project enforces a throttle)

If the backend enforces a per-IP login throttle, each seed that authenticates
and each UI login counts against it. Two mitigations can keep a parallel run
within that limit:

- **Per-worker seed caching**: wrap login-bearing seeds in a module-level cache
  so one worker logs in once instead of once per test (the data persists in the
  DB across tests). Pure data-creation seeds (registration via API) need no
  cache.
- **Modest concurrency**: 2 workers is a safe default; raise only when the
  backend's login budget allows it.

Template: `templates/ui-screenshots.spec.ts.example`

## 4. npm script + gitignore

```jsonc
// package.json
"scripts": {
  "test:screenshots": "playwright test -c playwright.screenshots.config.ts"
}
```

Ensure the screenshot output dir is gitignored (the config's `outputDir` — e.g.
`test-results/`).

## 5. Empty states and tenant setup

An `empty` route state describes the UI to review; it does not imply a separate
tenant or fixture environment. Use the manifest's `tenant` field only when a
route needs a different configured origin:

- Single-tenant: omit `tenant` and create the empty state with route seeds,
  project setup, or a dedicated test database. No fixture origin or fixture
  setup function is required by the generic spec.
- Multi-tenant: add a named entry to `uiReviewConfig.tenants` with its `origin`,
  then select that key per route/state (for example,
  `tenant: { empty: 'empty-fixture' }`). Put any project-specific, idempotent
  fixture preparation in that tenant's optional `prepare` callback.
- **Per-state tenant override**: use the primary origin for states that are
  independent of tenant data, and seed the state itself (for example, a newly
  created user may see an empty personal list on any tenant).
- Where a truly empty environment is infeasible for a specific page, restrict
  that page to the filled state and document it in the manifest `note` — do not
  fake the empty state.

Tenant preparation must be **idempotent** so parallel runs and re-runs are safe,
and must never alter data outside its intended test fixture.

## Reference templates

- `templates/playwright.screenshots.config.ts.example`
- `templates/ui-review-manifest.ts.example`
- `templates/ui-screenshots.spec.ts.example`
