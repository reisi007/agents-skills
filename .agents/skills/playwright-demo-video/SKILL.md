---
name: Playwright Demo Video
description: 'TRIGGER when a human-friendly demo/promo clip should be produced from a Playwright walkthrough, when a project needs a dedicated video/test category separate from E2E and screenshot suites, when a recording shows the white app boot/login screen or broken images, or when several promos with different flows must coexist. Load by exact ID (hidden).'
metadata:
  opencode/autoinvoke: false
---

# Playwright Demo Video — repeatable promo clips, isolated from QA suites

A promo clip is a **deliverable**, not a QA artifact. It gets its own Playwright
category so that neither the functional E2E suite nor the screenshot suite ever
loads it, records video, or slows down because of it.

This skill is hidden (`opencode/autoinvoke: false`): load it by exact ID. It is
deliberately a reference, not an always-on rule.

## 1. The category contract

| Concern | Rule |
|---|---|
| Directory | `tests/video/` (or the project's equivalent) — own `*.spec.ts` only |
| Config | own `playwright.video.config.ts`, `testDir` pointing at that directory, `outputDir` under `test-results/demo-video` |
| Default video fixture | `video: 'off'` — recording is enabled only in the context that records the promo |
| Script | `test:demo-video` → `playwright test -c playwright.video.config.ts` |
| Tag | every spec carries `@demo-video` **plus** a functional tag (`@feature:…`) |
| Output | `public/demo-videos/<spec-file-name>.webm`, derived from `testInfo.file` |

**Prove the isolation**, do not assume it:

```sh
npx playwright test -c playwright.screenshots.config.ts --list | grep -c 'tests/video'  # 0
npx playwright test -c playwright.video.config.ts --list                              # 1 per spec
```

Both the E2E config and the screenshot config must have `video: 'off'` and a
`testDir` that does not include the video directory. CI normally runs only the
functional suite; the promo is produced locally and the finished WebM is
committed as the artifact.

## 2. One spec = one clip = one flow

Multiple promos are expected. A new promo is a **new spec file**, with its own
storyboard. Do not add flags to an existing spec or branch its flow. Put the
shared mechanics in one `harness.ts` in the same directory:

- unrecorded login (credentials from the project's E2E session helper),
- recording that starts afterwards,
- boot trimming (§3),
- the real-image assertion (§5),
- publish-on-success (§6),
- the per-spec output path.

The harness must never contain the story. See `references/harness.md` for a
complete, framework-neutral implementation pattern.

## 3. No boot screen — trim, do not hope

Moving the *login* into an unrecorded context is not enough: Playwright's
`recordVideo` starts when the page is created, so `page.goto('/')` and the
loader/spinner/skeleton phase are still in the footage.

The harness must therefore measure the boot interval:

1. `startedAt = Date.now()` immediately before the recording context is created
   with `browser.newContext()` (the harness then creates the page and navigates).
2. Wait for the app to be truly ready — not only DOM presence: the loader
   fallback is gone, the main landmark is visible, and any known skeleton scroller
   has disappeared.
3. `bootSeconds = (Date.now() - startedAt) / 1000 + 0.3` (small guard).
4. After `context.close()`, read the raw path with `video.path()` and re-encode
   from `-ss <bootSeconds>` to the target with ffmpeg (frame-accurate VP9/WebM).

Resolve ffmpeg in this order: `$FFMPEG_PATH`, `ffmpeg` on `PATH`, then the
Playwright-bundled binary under `$PLAYWRIGHT_BROWSERS_PATH` (default
`~/.cache/ms-playwright`) in `ffmpeg-<build>/ffmpeg-linux` (also `ffmpeg-mac`,
`ffmpeg-win64.exe`). Fail loudly if none exists — never publish an untrimmed clip.

## 4. Pacing is part of the product

A viewer must be able to read the UI. Use a `BEAT` of roughly **1.2 s** as the
default pause, slow typing via `pressSequentially(text, { delay: 160…500 })`, and
long explicit holds at the moments that matter:

- autocomplete suggestions including the postal code: **~2.6 s**,
- autofilled country/state/ISO values: **~2 s**,
- a wrong value that is being corrected: **~2.6 s**,
- the version-history table before a restore: **~6 s**,
- final detail views: **~3 s** each.

## 5. Real images, not just a DOM node

A promo that shows a broken thumbnail is worse than no promo. For every image
shown in the gallery **and** in the detail view, assert `complete === true` and
`naturalWidth > 0`; on failure include the `src`, HTTP status and a short response
excerpt in the assertion message. Retry the scroll with `expect(...).toPass()` —
SWR can replace the `<img>` while a detail view settles, so holding a raw element
handle is flaky.

The same contract is the failure gate: a broken image fails the test and
**nothing is published**.

## 6. Publish only on success

`finish(true)` is the last statement of a successful spec; it closes the context
and saves the trimmed video. Any earlier failure — including a failed trim —
goes through `finish(false)`, which deletes the raw directory and the target
file. A failed run must leave **no downloadable video** behind. Keep the target
path stable and derived from the spec name so a stale clip cannot survive under
a different name.

## 7. Verify the artifact

1. Metadata: duration, resolution and codec via `ffmpeg -i <file>`.
2. Frames: extract stills at the start (`t≈0.1`, `t≈0.5`) and at each storyboard
   beat. The first frames must show the loaded app, never white/boot/skeleton.
3. Read the frames yourself — at minimum the key interaction, the wrong-value
   state, the history, and the final detail view. A green test alone is not
   visual verification.
4. If the project shares the file via `tailscale serve`, load the
   `tailscale-serve` skill by exact ID and **stop the share again** when the
   review is done.

Demo values and a sample storyboard are in `references/example-data.md`; the
lint/type gates that must stay green are listed there too.
