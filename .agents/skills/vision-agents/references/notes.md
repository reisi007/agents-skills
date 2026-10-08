# Vision Agents — notes

Background for `SKILL.md`: why the remaining role exists in this shape. Nothing
here is needed to call it; it records decisions so they are not re-litigated.

## Why `document` is gone (2026-10-08)

There used to be two roles: `vision-creative` and `document`. `document` covered
PDFs, rendered pages and reports — layout, readability, appearance — and needed a
model with **both** `image` and `pdf` in `capabilities.input`, because those are
independent capabilities: a model can see images and still be unable to read a
PDF. It was removed 2026-10-08 by user decision ("never used"), at the same time
the whole setup moved to the single $0 model `opencode-go/step-5-preview-free`
(input `[text,image,video]`, no `pdf`).

Consequences, both deliberate:

- There is **no PDF-reading path** in this setup. A PDF is neither a
  `vision-creative` question nor a main-agent question. If one is ever needed, a
  pdf-capable model must be configured first — a new decision, not a restore.
- Do not "fix" a future PDF request by re-adding the role or by routing it to
  `vision-creative`; both are recorded as wrong.

## Why there is no technical vision agent

There used to be three roles; `vision-technical` (screenshot reading,
EXIF-relevant visual details, image categorisation) was removed once image
input became a hard requirement for the root `model` and every
`agent.<role>.model` (`model-updater` → "Hard requirements"). Those reads are
the main agent's own job now — done inline, never delegated. What remains is
**role separation, not capability separation**: read-only specialists kept for
judgement the main agent should not trust itself on alone.

## Why the model is not pinned here

Model choice rots fast; the `model-updater` skill exists to re-rank candidates
against live price/capability trackers and stamps `// updated: YYYY-MM-DD` for
staleness detection. Pinning a model ID in this skill would fork that process
and drift. Per-role prefs it applies on top of the vision-capable gate:
`vision-creative` wants image + video and the strongest visual reader, not the
cheapest. (The `document` row — `pdf` on top of `image` — went with the role;
see "Why `document` is gone" above.)

## Why the 10-image cap

A second-opinion call degrades past ~10 images: findings stop being citable per
file and the question stops being concrete. Larger batches split by
state → viewport → route before escalating — and low-confidence full-page PNGs
get re-shot as sections first (`ui-review` → `references/harness.md`).

## Omitted by owner preference

No author-side agent is defined here (drafting/creating visuals on demand) —
deliberately out of scope for this read-only role.
