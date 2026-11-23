---
name: UI Review
description: 'TRIGGER on UI review/improvement/screenshot requests or checking the visual state of an app (web or native): capture views and states, analyze them against a checklist (the configured model is vision-capable — no vision subagent needed), then let findings drive fixes.'
---

# UI Review — repeatable visual QA loop

This skill turns an app's visual state into a repeatable, reviewable artifact.
The core loop is technology-neutral:

1. **Capture** representative views × states × viewports with the project's harness.
2. **Vision analysis** — read the images yourself against a checklist.
3. **Findings report** — consolidate severities, source locations and screenshots.
4. **Fix & verify** — delegate targeted fixes, re-capture, diff old vs new.

The screenshot set is **intentionally separate from functional tests**: it is not
a test and never asserts behavior. It only *captures pixels* so a human or you can
judge the design. Nothing here gates CI unless the project explicitly says so.

> For a **full live-site audit** (SEO, image quality, performance, content) rather
> than an in-app visual pass, load the hidden `web-audit` skill by exact ID.

## Adapter selection

Capture mechanics differ by UI stack, so the neutral core delegates them to an
**adapter** under `references/adapters/`. Two adapters ship:

- `references/adapters/playwright/harness.md` — web apps (dedicated screenshot
  config, route/state manifest, manifest-driven spec, sampled section captures).
- `references/adapters/rune/harness.md` — Rune / native Rust UIs (headless
  fixtures, geometry assertions, mandatory live production screenshot).

Pick one **from the consuming project's existing configuration** (its `AGENTS.md`,
README, or an existing UI-stack setting) or by **auto-detection** from the project
layout: a Playwright config or `package.json` → `playwright`; a Rust `Cargo.toml`
with a Rune harness script → `rune`. If both or neither applies, ask the user.

There is **no new mandatory manifest parameter**: reuse whatever the project
already declares. The adapter is a choice of which harness document to read, not
a field to add to a config. Once selected, follow its `harness.md` for the capture
command, artifact layout, and what a failed capture means.

## Prereqs

- The app must run locally (dev server, binary, or deterministic fixtures).
- The project must have a capture harness for its stack; if it is missing,
  scaffold it as described in the selected adapter's `harness.md`.
- No vision plugin needed: the configured model reads images (see the
  `update-models` skill's hard requirement).

## Step 1 — Capture

Run the selected adapter's capture command from the consuming project's root.
The adapter defines the command, the artifact layout and the failure policy.
A failed capture means the harness (or the app) is broken — fix it before moving on.

Keep the capture set separate from the project's functional suite where the stack
allows it: reviewers need stable, readable images, not behavioral assertions.
Long pages or large UIs need a review **budget** — prefer readable, viewport-sized
images and sampled regions over one downscaled full-view capture. The Playwright
adapter documents its sampling policy; the Rune adapter uses fixed fixtures and
adds a live screenshot.

## Step 2 — Vision analysis

Read the generated images from disk and analyze them yourself — you are
vision-capable, so there is no vision subagent in the loop. Stay within **~10
images per read** — always split into batches:

1. **By state** first (for example `filled` then `empty`, or light then dark).
2. **By viewport** within each state, then by view/route when a batch is large.
3. Chunk alphabetically by name if a batch is still too large.

For each batch:

- Run the checklist in `references/ui-review-checklist.md` against every image.
- Report findings per image, referencing the file name.

**Hard calls.** A finding you are not sure about — a hairline border, faint
contrast, an inconsistent gap, an unreadable downscaled region — re-read the image
with one concrete question in mind ("is this gap consistent across these three
cards?"). Do not guess, and do not pad the report with low-confidence findings.

## Step 3 — Findings report

Consolidate every batch into a single findings report using the template in
`references/findings-report.md` (columns `Id | Severity | Status | Owner |
Ticket | File:Line | Screenshot | Finding | Suggested fix`). Assign each finding
a severity from the **canonical vocabulary** (`ratchet-gates`,
`references/vocabulary.md`); the render criteria that put a defect into which
level live in `references/findings-report.md` — cite them, do not restate them.

`critical` and `high` findings **block** an `APPROVED` verdict for a view.

## Step 4 — Fix & verify

Delegate fixes following the repo's `AGENTS.md` delegation rules (implementer +
separate verifier). After a change:

1. Re-capture **only the affected views/states** using the adapter's filter
   (for example Playwright's `--grep`, or the Rune fixture scene selector).
2. Compare **old vs new** images (diff) yourself and confirm the finding is
   resolved (or a NEW issue appeared) — re-read the images if the difference is
   too fine-grained to call confidently.
3. Re-verify the whole affected batch before closing the loop.

## Adding views / states

Add one entry per view to the project's existing capture configuration (the
Playwright adapter calls this the route/state manifest): declare the view pattern,
the states to review, and its identifying metadata. Seeds resolve real ids or
credentials from the project's test data at runtime. The generic harness picks the
new entry up; nothing else changes. Where the backend enforces a login throttle,
keep login-bearing seeds cached per worker (see the Playwright adapter).

## Reference files

- `references/ui-review-checklist.md` — the checklist applied to each batch.
- `references/findings-report.md` — findings template + severity criteria.
- `references/adapters/playwright/harness.md` — Playwright capture harness.
- `references/adapters/playwright/templates/` — copyable Playwright starting points.
- `references/adapters/rune/harness.md` — Rune fixtures, geometry checks, live screenshot.
