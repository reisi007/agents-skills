# Vision Agents — notes

Background for `SKILL.md`: why the two roles exist in this shape. Nothing here
is needed to call them; it records decisions so they are not re-litigated.

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
cheapest; `document` additionally requires `pdf` in `capabilities.input`,
because image and PDF input are independent capabilities — a model can see
images and still be unable to read a PDF, which is exactly why `document` may
keep a different (usually more expensive) model than everything else.

## Why the 10-image cap

A second-opinion call degrades past ~10 images: findings stop being citable per
file and the question stops being concrete. Larger batches split by
state → viewport → route before escalating — and low-confidence full-page PNGs
get re-shot as sections first (`ui-review` → `references/harness.md`).

## Omitted by owner preference

No author-side agent is defined here (drafting/creating visuals on demand) —
deliberately out of scope for these two read-only roles.
