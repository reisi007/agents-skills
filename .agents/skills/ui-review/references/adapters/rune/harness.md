# Rune adapter — UI-review harness

Rune renders a Rust UI from a view/`El` tree; there is no browser and no DOM.
Capture therefore happens in **two layers, both required**:

1. **Headless fixtures** — deterministic PNGs plus inspectable element trees for
   a fixed matrix of scenes × themes × viewports. These drive the visual review
   and the geometry assertions.
2. **A live screenshot of the installed production UI** — fixtures render fixture
   cards, not the production card path. A fixture-only set is never enough for an
   `APPROVED` verdict.

Everything below that names a path, script, key, scene or viewport is a **worked
example from the `prime-photos` project** (its issue #72 is the case study). Treat
it as an example, not a universal Rune convention: substitute your own fixture
binary, keys and dimensions. Paths are relative to `references/` unless stated.

## 1. Headless fixtures

Example: `scripts/capture-rune-ui-review.sh` runs the fixture binary
(`RUNE_UI_BIN`, default `target/debug/prime-photos`) and writes to
`RUNE_UI_REVIEW_OUT` (default `target/rune-ui-review/`). It invokes the binary with
fixture flags such as `--rune-backup-smoke`, `--rune-login-fixture`, plus
`--scene`, `--theme`, `--size`, and `--snap` (PNG) / `--tree` (JSON element tree).

The example matrix:

- viewports **1400×900**, **1000×700**, **760×560**;
- themes **light** and **dark**;
- named scenes per view (backup: `mixed`, `uploading`, `paused`, `all-done`,
  `failures`, `empty`, `many-folders`, `about`, `licenses`; plus login and settings
  fixtures).

Naming: `<view>-<scene>-<theme>-<width>x<height>.png` with a matching `.json`
tree. The tree is what makes a finding checkable: it lists keys, roles, states and
the geometry of every presented element. Keep a stable filename per state, fix the
locale in the script (the example exports `LC_ALL=de_DE.UTF-8`), and keep the
fixture output directory out of version control.

## 2. Geometry checks in unit tests

Pixels cannot prove geometry. Assert the *presented* layout in unit tests next to
the view, using the runtime's element data:

- `Runtime::presented(key)` → the drawn rect `[x, y, width, height]` (and visible
  rect) of a keyed element; use it for spacing and alignment assertions.
- `Runtime::elements()` → `ElementInfo.hover`, the public hover track; use it to
  prove a disabled control paints no hover overlay.
- `Runtime::accessibility_json()` → roles, states and checked values.

Example assertions from `prime-photos` issue #72
(`src/rune_backup_live/targets/tests.rs`):

- **Label ↔ toggle gap and right alignment.** For the label and its switch,
  `switch.left - label.right` must equal the design-system step (the example uses
  8 pt, `tok::space::S2`), both share a centre line, the switch's right edge equals
  the card's right edge minus padding, and the switch box matches its track.
- **Disabled switch stays right-aligned.** Run the same geometry over enabled and
  disabled cards (the example uses a `NotFound` folder status) at every viewport.
  Disabled must not drift left or lose its label grouping.
- **No hover overlay on disabled controls.** After hovering, `ElementInfo.hover`
  of disabled upload/switch/remove must stay at ~0, while an enabled neighbour
  must hover (positive control). `disabled(true)` alone does **not** stop Rune
  painting `El::hover` — the disabled builder must simply not set one.
- **Disabled clicks change nothing.** Pair the visual assertion with a state
  assertion: a disabled switch must not toggle, upload must not start, remove
  must not delete.

Run these with the project's normal unit-test command. Unlike the screenshot set,
they are real assertions and may gate CI.

## 3. Mandatory live production screenshot (required)

Headless fixtures do not render production cards, so after building, signing and
installing the app, take **at least one live screenshot of the production UI**
with `screencapture` (macOS), store it with the review artifacts, and read it
yourself in the vision step. Fixture-only verdicts are not `APPROVED` verdicts.

Example flow (`prime-photos`):

```sh
# after installing the locally built, ad-hoc signed bundle
open -a "Prime Photos"
# bring the relevant window to the front, then:
screencapture -x target/rune-ui-review/live-production-card.png
```

Notes:

- A **macOS keychain dialog** can block the app on first launch. The **user must
  confirm it in the GUI**; the agent must never ask for, type or store a password.
  If the app is blocked, stop and hand off to the user.
- Capture the states reviewed in fixtures where possible (a card whose folder is
  missing, an active upload with its spinner, light and dark). Verify the live
  result against the same checklist.
- `screencapture` is macOS-specific; on other platforms use the equivalent
  command, but keep the rule: one real, installed-app image.

## 4. Publishing is a separate, approval-gated step

This is a **project user rule from `prime-photos`**, included here as a worked
example — *not* a global rule of this skill. Do **not** publish a GitHub release,
create a tag, or upload a DMG without the user's **explicit, prior approval**. A
green build, green `ratchet check`, passing CI run or successful local install is
**not** approval. Ask explicitly before any `gh release create`, tag push or asset
upload; without an answer, publish nothing. If something was published by mistake,
remove it on instruction.

## 5. Reporting

Feed the PNGs, JSON trees and the live screenshot into the shared checklist and
findings report (`ui-review-checklist.md`, `findings-report.md`).
Keep the same severity vocabulary and the `critical`/`high` blocking rule. A
finding from the live screenshot must name that screenshot, not a fixture.
