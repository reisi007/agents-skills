# Vision batches — the contract

## Batch shape

- **Damage-prioritised manifest.** Score candidates by what a defect costs: page
  reach (log-scaled), bytes, and alt risk (missing/empty/conflicting values). The
  manifest excludes chrome — logos, icons, avatars, badges, sprites, tiny images
  — and vectors, unless a specific question targets them. Reference run: the
  manifest held **466 images across 47 batches** (`data/vision-batches.json`) out
  of the 658 downloaded files, so **192** were excluded and assessed statically
  only — which the report states.
- **~10 images per batch** (`BATCH = 10` in the manifest script). A batch larger
  than that loses detail, and a batch that fails costs the whole batch. When a
  call is too fine-grained to trust, re-read the images yourself — the configured
  model is vision-capable.
- **All batches dispatched in parallel** on the default model. The scatter
  (below) is the constraint, not cost.
- **One raw file per batch**, never a merged summary: `data/vision-raw/b01.tsv`,
  `b02.tsv`, ….
- **Prompt per batch** kept in `data/prompts/batch-NN.txt`, so any verdict can be
  replayed or challenged later.
- **Retry path.** A batch that fails or returns unparseable output is re-launched
  and written under its own name, so the raw record shows both attempts. In the
  reference run the retried pair is `b30.tsv` / `b30-alt.tsv` — the only two raw
  files in the archive that list the same 10 images, with different verdicts.
  Never overwrite raw output.
- **De-duplicate before counting.** A retry that is kept twice duplicates every row
  of that batch, so any count taken from the raw rows is inflated. In the
  reference run the manifest images number 466, while `data/vision.json` holds
  **476 verdict rows** — the 10 duplicated rows of the retried batch. Every
  "images reviewed" figure must be derived from the manifest, not from the verdict
  rows, and the retry must be visible as a retry. This is the same cause class as
  the retraction list in `false-alarms.md`: a count computed over the wrong
  population.

## Raw TSV schema

One row per image, tab-separated, no header, `#` lines are comments:

```
<file name>\t<score 1-5>\t<type>\t<content|decorative>\t<alt_match>\t<issue>\t<suggested alt>
```

The parse step normalises case (`.toLowerCase()`), maps a couple of values onto
others, and joins by file name.

**What the reference parse actually does — and does not do.** It drops a row only
when the file name is unknown to `images.json`, and that `continue` (line 18 of
`parse-vision.mjs`) never counts what it dropped: an unknown file is silently
absent from `vision.json`, so a typo or a renamed file removes a verdict without
a trace. It does not validate any field against an allowed set; the only value
handling is `.toLowerCase()` plus the `wrong-language` → `superseded` remap, and
all 476 raw rows survive verbatim into the output. A check downstream that then
counts `wrong-language` can only ever print 0 — which is exactly why
`templates/fp-audit.mjs` reports an expected vocabulary value that matches zero
records as ABSENT rather than as a clean zero.

**Requirement for the next run, not what the reference did:** count and report
dropped rows, validate each field against its allowed values, and fail loudly on
an unknown vocabulary value instead of passing it through.

## The two hard rules

### (a) Do not feed measurements into the prompt

If a value was in the prompt, the agent's verdict about that value is **your
input returned**, not an observation. The reference run proved it: 95 "oversized"
/ "low-res" reports were the dimensions and file size it had been given,
including 15 reports about files under 100 KB, six of them logos. Those claims
belong to the static analysis, which measured the files directly.

What may go in the prompt: the current alt text (it is the object under review),
the file path, and the question. What may not: dimensions, byte size, format,
page count, or any property you intend to count as evidence about the image.

### (b) Measure the scatter before trusting a score

Draw a sample and have **two independently started agents** score it. Publish the
per-criterion agreement next to the number it qualifies, and demote whatever
disagrees. Sample: ~10 images, spread across the score range and across the issue
types, drawn from the manifest (not hand-picked — picking is how you get the
agreement you want).

Reference run, 10 images, two independent agents:

| Criterion | Agreement | Consequence |
|---|---|---|
| alt text verdict (`alt_match`) | **10/10 = 100 %** | load-bearing; the P1 measures rest on it |
| quality score (1–5) | Δ **0.50** mean, max **2 points** | ranking hint only, never a measurement |
| defect category | **6/10 = 60 %** | orienting |

The average score of that run (3.80/5) is published as a *distribution* and as a
statement about the model's consistency — not as a quality measurement of the
images. A value that oscillates between 2 and 5 on identical input measures the
agent.

## What the vision pass is for — and not for

| Use it for | Never use it for |
|---|---|
| Alt text that describes a **different** image than the one shown (reference run: 12 cases — the finding HTML analysis cannot reach) | Dimensions, pixel size, file size, "oversized"/"low-res" |
| Two images sharing one alt text (copy-paste errors) | "Wrong language" verdicts without a page→language assignment (18/18 refuted) |
| Baked-in text, broken/placeholder images, wrong crop, subject clarity | Alt missing / empty / too long — pure HTML properties, fully derivable from `data/images.json` |
| A suggested alt text, marked as a draft | A quality score presented as a measurement |

Everything in the left column is a judgement about pixels. Everything in the
right column is either already measured statically, or a conclusion the agent
cannot support with what it was given. The report separates the two: vision
verdicts are labelled as the model's judgement, and derived properties are
labelled as coming from the HTML.
