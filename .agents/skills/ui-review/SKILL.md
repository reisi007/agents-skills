---
name: UI Review
description: 'TRIGGER on UI review/improvement/screenshot requests or when the user wants to check the visual state of a web app: Playwright screenshots of manifest-configured routes and states, analyzed against a checklist.'
---

# UI Review — repeatable visual QA loop

This skill turns a web app's visual state into a repeatable, reviewable artifact:
Playwright captures the routes and states configured in the project's manifest
(a route may include **filled**, **empty**, or both), you analyze them against a
checklist (the configured model is vision-capable — no vision subagent needed),
and the resulting findings drive targeted UI fixes.

Each route/state/viewport combo produces readable, viewport-height section
captures. To keep large galleries from overwhelming review, the harness samples
the page top and current end by default, and claims the end as a settled footer
only when the manifest's readiness hook is configured; see
`references/harness.md` for the policy and short-page full-page overviews. Long
full-page images are not evidence by themselves: they are downscaled and can make
regions below the fold unreadable. The harness also supports apps that scroll in
an inner overflow container (see `references/harness.md`).

> For a **full live-site audit** (SEO, image quality, performance, content) rather
> than an in-app visual pass, load the hidden `web-audit` skill by exact ID.

The screenshot set is **intentionally separate from the normal E2E suite**: it is
not a functional test. It never asserts behavior — it only *captures pixels* so a
human or you can judge the design. Nothing here gates CI.

## Prereqs

- The project must run locally (dev server + backend/API up).
- The project must have the **screenshot harness**: a dedicated
  `playwright.screenshots.config.ts`, a route/state **manifest**, and a generic
  manifest-driven **spec**.
- If the harness is missing, scaffold it first — see
  `references/harness.md` and the copyable templates in `references/templates/`.
- No vision plugin needed: the configured model reads images (see the
  `update-models` skill's hard requirement).

## Step 1 — Capture

Run the screenshot set with the consuming project's configured script, from the
directory containing its package scripts:

```bash
<package-manager> run test:screenshots
```

Alternatively, run `playwright test -c playwright.screenshots.config.ts` (or the
project's equivalent command). The dedicated config means the
standard suite (`playwright test`) stays untouched — the screenshot set never
runs in CI's normal E2E pipeline.

Screenshots and coverage files land under the config's `outputDir`, organized as:

```
<outputDir>/<state>/<viewport>/<name>.png        # full-page — only for short pages (see below)
<outputDir>/<state>/<viewport>/<name>-secN.png   # viewport-height sections, sampled (N = 0,1,2,…)
<outputDir>/<state>/<viewport>/<name>.json       # capture coverage metadata
  filled/desktop/home-sec0.png
  filled/desktop/home-sec1.png
  filled/desktop/home-sec18.png   # end candidate; confirmed footer is recorded in JSON
  empty/desktop/home-sec0.png
  filled/mobile/admin-users-sec0.png
  ...
```

Sections are **sampled, not exhaustive**: by default the page top and current end
are written, while the middle may be skipped; the end is only reported as a footer
when readiness is configured. `secN` indexes are therefore not always
contiguous. Each capture also writes a `.json` coverage record, so the files show
what was and was not looked at. Short pages additionally get a full-page overview
where the page's scroll layout supports it; see `references/harness.md` for the
exact thresholds and coverage fields.

The consuming project's manifest defines which routes × states × viewports are
captured, and may override the sampling windows per route. A failed screenshot
test means the harness (or the page) is broken — fix it before moving on.

## Step 2 — Vision analysis

Read the generated PNGs from disk and analyze them yourself — you are
vision-capable, so there is no vision subagent in the loop. Stay within **~10
images per read** — always split into batches:

1. **By configured state** first: analyze each state present in the manifest
   (for example, `filled` and then `empty`).
2. **By viewport** within each state: desktop batch, then mobile batch.
3. **By route** when a batch is still too large: chunk routes alphabetically.

For each batch:

- Run the checklist in `references/ui-review-checklist.md` against every image.
- Report findings per image, referencing the file name.

**Hard calls.** A finding you are not sure about — a hairline
border, faint contrast, an 8px gap that may or may not be inconsistent, a
downscaled full-page PNG whose suspect region is unreadable — re-read the image
yourself with one concrete question in mind ("is this gap consistent across
these three cards?"). The configured model is vision-capable; do not guess, and
do not pad the report with low-confidence findings.

## Step 3 — Findings report

Consolidate every batch into a single findings report using the template in
`references/findings-report.md` (columns `Id | Severity | Status | Owner |
Ticket | File:Line | Screenshot | Finding | Suggested fix`). Assign each
finding a severity from the **canonical vocabulary** (`ratchet-gates`,
`references/vocabulary.md`); the render criteria that put a defect into which
level live in `references/findings-report.md` — cite them, do not restate them.

`critical` and `high` findings **block** an APPROVED verdict for a page.

## Step 4 — Fix & verify

Delegate fixes following the repo's `AGENTS.md` delegation rules (implementer +
separate verifier). After a change:

1. Re-run the screenshot set **only for the affected routes** — either via
   Playwright's `--grep`/`-g` filter (each test is tagged `@screenshot` and
   named after the route) or a manifest edit.
2. Compare **old vs new** screenshots (diff) for the affected routes yourself and
   confirm the finding is resolved (or a NEW issue appeared) — re-read the
   images yourself if the difference is too fine-grained to call confidently.
3. Re-verify the whole affected batch before closing the loop.

## Adding routes / states

Edit the consuming project's manifest: add one entry per route to the `routes`
array. Each entry declares the route pattern, the states
(`filled`/`empty`), and the required `expectedTitle`; entries may also include
auth, viewports, nav steps, notes, per-state seeds, and per-state `tenant` keys
for configured origins.
For dynamic params, seeds resolve real ids/credentials from seeded data at
runtime. The generic spec picks the new route up automatically; nothing else
changes. Single-tenant apps can omit `tenant` and fixture setup. Where the
backend enforces a login throttle, keep login-bearing seeds per-worker-cached
(see `references/harness.md`) to stay within its limit.

## Reference files

- `references/ui-review-checklist.md` — the checklist you apply to each batch.
- `references/findings-report.md` — the findings report template + severities.
- `references/harness.md` — how to scaffold the harness in any web project.
- `references/templates/` — copyable starting points for the harness.
