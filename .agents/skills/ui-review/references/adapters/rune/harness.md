# Rune adapter — UI-review harness

Rune renders a Rust UI from a view/`El` tree; there is no browser and no DOM.
Capture therefore happens in **two layers with a clear priority**:

1. **Headless fixtures of the real production view** — the **primary** review
   artifact. A debug fixture renders the *actual* production view with synthetic
   data, producing deterministic PNGs plus inspectable element trees for a fixed
   matrix of scenes × themes × viewports. These drive the visual review and the
   geometry assertions.
2. **A live screenshot of the installed production UI** — **supplementary** only.
   It is an additional sanity check on the real, installed app, not a substitute
   for the fixture set and not a prerequisite for an `APPROVED` verdict.

Everything below that names a path, script, key, scene or viewport is a **worked
example from the `prime-photos` project** (its issue #73 is the case study). Treat
it as an example, not a universal Rune convention: substitute your own fixture
binary, keys and dimensions. Paths are relative to `references/` unless stated.

## 1. Headless fixtures of the real production view

The fixture must render the **real production view** — the same view code the
shipped app uses — with synthetic data injected. It does **not** build a
separate look-alike UI: reviewing a parallel UI would review the wrong pixels.
Make the fake data unmistakable in the rendered UI itself. The example shows a
banner reading "Synthetische Fixture-Daten – keine echten Ordner, Konten oder
Uploads" and uses synthetic identifiers under `/synthetic/...`, so no capture can
be mistaken for real user data.

Example: `scripts/capture-rune-ui-review.sh` runs the fixture binary
(`RUNE_UI_BIN`, default `target/debug/prime-photos`) with
`--rune-backup-live-fixture`, plus `--scene`, `--theme`, `--size`, and `--snap`
(PNG) / `--tree` (JSON element tree). It writes to `RUNE_UI_REVIEW_OUT`
(default `target/rune-ui-review/`). For example:

```sh
target/debug/prime-photos --rune-backup-live-fixture \
  --scene mixed|empty|settings|about|licenses \
  --theme light|dark --size 1400x900 \
  --snap OUT.png        # or --tree OUT.json
```

The example matrix:

- scenes, one per production view/state: `mixed`, `empty`, `settings`, `about`,
  `licenses`. `mixed` renders synthetic target cards covering the states of
  interest (an upload in progress with a spinner, a missing folder with disabled
  controls, and an error); `empty` is the no-content state; `settings`, `about`
  and `licenses` are the remaining production pages.
- themes: **light** and **dark** for every scene.
- viewports: **1400×900** for every scene; **1000×700** and **760×560**
  additionally for `mixed` and `empty`.

The example captures 18 PNGs and 18 matching JSON trees.

Naming: `live-<scene>-<theme>-<width>x<height>.{png,json}`, e.g.
`live-mixed-light-1400x900.png` with `live-mixed-light-1400x900.json`. The tree
is what makes a finding checkable: it lists keys, roles, states and the geometry
of every presented element. Keep a stable filename per state, fix the locale in
the script (the example exports `LC_ALL=de_DE.UTF-8`), and keep the fixture
output directory out of version control.

## 2. Geometry checks in unit tests

Pixels cannot prove geometry. Assert the *presented* layout in unit tests next to
the view, using the runtime's element data:

- `Runtime::presented(key)` → the drawn rect `[x, y, width, height]` (and visible
  rect) of a keyed element; use it for spacing and alignment assertions.
- `Runtime::elements()` → `ElementInfo.hover`, the public hover track; use it to
  prove a disabled control paints no hover overlay.
- `Runtime::accessibility_json()` → roles, states and checked values.

Example assertions from `prime-photos` issue #73
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

## 3. Supplementary live production screenshot

The fixture images of the real production view are the primary review artifact.
As an **additional** sanity check, take at least one live screenshot of the
installed, real production UI after building/signing/installing, store it with
the review artifacts, and read it yourself in the vision step. It is not a gate:
a missing or blocked live screenshot does not by itself turn an otherwise clean
fixture set into `CHANGES REQUIRED`, and it never replaces the fixture set.

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
  command. This check stays a supplement, not a gate.

## 4. Publishing is a separate, approval-gated step

This is a **project user rule from `prime-photos`**, included here as a worked
example — *not* a global rule of this skill. Do **not** publish a GitHub release,
create a tag, or upload a DMG without the user's **explicit, prior approval**. A
green build, green `ratchet check`, passing CI run or successful local install is
**not** approval. Ask explicitly before any `gh release create`, tag push or asset
upload; without an answer, publish nothing. If something was published by mistake,
remove it on instruction.

## 5. Reporting

Feed the PNGs, JSON trees and the supplementary live screenshot into the shared
checklist and findings report (`ui-review-checklist.md`, `findings-report.md`).
Keep the same severity vocabulary and the `critical`/`high` blocking rule. Name
the exact artifact a finding came from: a live-screenshot finding names that
screenshot, a fixture finding names its `live-<scene>-<theme>-<...>.png` file.
