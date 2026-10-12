---
name: Web Audit
description: Audit a live website end-to-end — SEO, image quality, performance, content — and ship a self-contained HTML/text archive; the mandatory part is the false-positive audit of your own rules, which gates publication. TRIGGER when analyzing/auditing a website (SEO, image quality, performance, content defects, Core Web Vitals), and when a previous analysis turned out to be wrong or its numbers are disputed.
---

# Web Audit — audit the site, then audit yourself

Read-only audit of a live website, ending in one artifact the client can open
offline: `report.html` + `report.txt` + raw data + the original images in a ZIP.
The process below is the corrected version of a real run (reference run
2026-09-29: 472 pages, 3614 image references, 247.5 MB). Its first pass reported
faithfully what it had *measured*; auditing it against its own raw data withdrew
~20 findings, several of them 100 % false alarms. **That gate is the point of
this skill** — everything else is plumbing. No site-specific rule here is
universal; the numbers are that run's measured case. All files in this skill are
English; **the generated report follows the audience's language**.

## Stage 1 — Scope and ground rules

- **Read-only.** GET/HEAD against the target. Nothing is written to the site, no
  login, no form submission. State that in the report.
- **Date stamp the run.** No date, no reproducibility. Record target, sitemap
  URL, and date in the report header and in `README.txt`. Sitemap URLs that 404
  are a finding of their own (reference run: 2).
- Layout: `data/`, `images/dl/`, `scripts/`, `report.html`, `report.txt`, `README.txt`.

## Stage 2 — Collect before interpreting

| Step | Output |
|---|---|
| parse-sitemap | `data/urls.json`, `data/sitemap.xml` (the original, as served) |
| crawl (parallel, capped, retry, browser UA) | `data/pages.json`, raw HTML in `data/cache/` (never shipped) |
| download-images | `images/dl/`, `data/images.json` |

- Extract **every reference kind**: `<img>` (src/srcset/alt/loading/width/height),
  `<picture>/<source>`, CSS backgrounds from `style` attributes and `<style>`
  blocks, `og:image`, `twitter:image`. The kind decides whether a criterion
  applies at all.
- Read **format and pixel dimensions from the binary headers**, never from the
  file name; record bytes, `content-type`, `cache-control`, HTTP status (reference
  run: 470 of 472 pages 200, 247.5 MB).

## Stage 3 — Static analysis

- Rules emit `{severity, code, message, image|page}`. Codes are stable — the
  retraction section quotes them, so they are part of the report's API.
- Every rule states what it **measured** (an attribute, a header, a byte count)
  versus what it **inferred** (content vs. decoration, a class guessed from a name
  or CSS class). Measured facts outrank pattern guesses in severity, and a rule
  that found nothing stays out of the report — a line with the number 0 proves
  nothing unless the zero *is* the finding.

## Stage 4 — Vision fan-out

- Build a **damage-prioritised manifest**: page reach + bytes + alt risk, minus
  obvious chrome (logos, icons, avatars, tiny, vectors) unless a specific
  question applies. Reference run: 466 manifest images over the 658 downloaded
  files (192 excluded as chrome).
- **~10 images per subagent, all batches in parallel** on a free model. One raw
  TSV per batch — never a merged summary — then a parse step into
  `data/vision.json`; keep the prompts for replay. Reference run: 47 batches
  (`data/vision-batches.json`).
- **Retry path exists**: a failed batch is re-launched and its raw output kept
  under its own name (one batch needed it in the reference run). A retry kept
  twice inflates every count derived from the raw rows — see `false-alarms.md`.
- **Never put a measurement in the prompt** if you want the verdict to count as
  independent evidence — see `references/vision-batches.md`.

## Stage 5 — Context reconstruction

- **Alt text per page and per language.** A de-duplicated list of alt values
  loses the page→alt mapping and manufactures a "multilingual alt" finding out
  of a correct bilingual site.
- **"Is there visible text next to this image"** — *measure the window, do not
  assume it*. A 900-character window cut a caption sitting 1370 characters away
  behind a 1.2 kB inline SVG; widening to 2600 reclassified 56 cases from
  "unlabelled" to "labelled". Widen until the count stops moving.
- **Box reservation**: the reference does not parse a real ancestor chain — it
  reads a ±300/400-character CSS window around the tag, a sibling/ancestor proxy
  for `padding-top` / `aspect-ratio` / `height`. Keep the rule separate from the
  implementation: reservation must be **measured** before a missing
  `width`/`height` counts as a shift.
- **srcset reality**: count distinct URLs among the width candidates. The same
  URL for all 8 is a finding — worse than no srcset: the phone downloads the
  original while the attribute pretends otherwise.
- **Order matters**: decorative and `aria-hidden` are evaluated *before*
  labelling. An order bug escalated 35 small icons from hint to warning.

## Stage 6 — The false-positive audit — a gate, not a courtesy

- Own script (`templates/fp-audit.mjs`), re-reading `data/images.json`,
  `data/findings.json` and `data/vision.json` and re-examining each rule group.
- Run the rule groups **in parallel subagents, one agent per rule group** — alt
  text / CLS+performance / formats+sizes / vision findings / duplicates+pages.
- Every rule group answers the same questions: does the criterion apply to these
  records? was the field populated? was the parameter measured on this corpus?
  does the grouping double count? is the order right? is this correct behaviour
  reported as a defect? is the evidence my own input returned?
- **A retracted check is either removed or replaced by a real finding — never
  left as a number.** Every counter prints a number with the field or code it
  read, or an explicit "ABSENT — adapt" — never a bare 0. Cause classes and the
  retracted list: `false-alarms.md`.

## Stage 7 — Classify every finding

| Class | Meaning |
|---|---|
| `BELEGT` | measured directly against headers/HTML/binaries |
| `HEURISTIK` | pattern-based; population right, individual cases may be wrong |
| `ZURÜCKGENOMMEN` | retracted, published openly with cause and corrected number |

`ZURÜCKGENOMMEN` is its own section, not a footnote: a reader who sees only the
final numbers re-produces the same false alarms.

## Stage 8 — Measure the agent's scatter before trusting a score

- Score ~10 images with **two independently started agents**; publish agreement
  per criterion; demote what disagrees.
- Reference run: alt-text verdict 10/10 = 100 % (load-bearing, P1 measures rest
  on it) · quality score Δ0.50 mean, max 2 points (ranking hint only; the 3.80/5
  average describes the model, not the images) · defect category 6/10 = 60 %.

## Stage 9 — Build the artifact

`report.html` + `report.txt` + `data/*.json` + `images/dl/` + `README.txt` +
ZIP. Each finding carries a **MASSNAHME**, findings are grouped by severity, the
retraction section exists, and the methodology appendix lists execution steps,
scripts, raw data, limitations and the date. Every count names its population.
Full contract: `references/report-contract.md`.

## Stage 10 — Verify the artifact

- Tag balance; every relative path resolves; every preview file exists.
- **Every anchor actually lands** — `content-visibility` on a section can swallow
  an anchor jump. Verify in a browser, not in the source: the one step that needs
  a browser; the pipeline scripts need none.
- **Every number quoted in prose is re-derivable from the raw data** — a separate
  step, not part of the structural verifier: diff the two twins' numbers. The
  reference run failed this; its action plan still carried "saves ~223 MB", 26
  low-resolution against the corrected 2, 7 copy-paste against 5. Worked example
  in `references/report-contract.md`.

## Stage 11 — Deliver

A ZIP with only the images the report references, offline-openable (`file://`
relative paths, no network, no CDN, writes nothing on open), with `README.txt`
naming what is excluded and why and reproducing the false-alarm note.

## Core rules

1. Raw data before findings — always.
2. A finding names what it *measured*; inferred goes in its own class.
3. The false-positive audit gates publication. No exceptions.
4. A retracted finding is published with its cause, never deleted.
5. An agent echoing your own metadata is not evidence.
6. Measure the distribution before setting a threshold, window or ratio.
7. Measure the scatter before publishing a score.
8. A check whose field was never populated measures nothing.
9. Read-only. Nothing on the target changes. The archive works offline, on
   someone else's machine, next year.

## Reference files

- `references/pipeline.md` — stages, in/out files, the ordering constraint.
- `references/false-alarms.md` — cause classes, the ~20 retracted findings,
  audit mechanics.
- `references/report-contract.md` — the artifact, its rules and its appendix.
- `references/vision-batches.md` — batching, prompt hygiene, scatter.
- `templates/fp-audit.mjs` — project-neutral skeleton for the audit gate.
