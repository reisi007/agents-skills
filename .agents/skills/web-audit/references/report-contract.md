# Report contract — the artifact

The deliverable is a directory that works with no server, no network and no
build step, plus a ZIP of the same. Structure (from the reference run):

```
report.html        main report, a web page. Entry point for everything else
report.txt         the same findings as text, for grep/diff/CI
report-<slug>.zip  only the images the report references
data/*.json        raw data: pages, images, findings, vision verdicts, alt-by-page, label-context
data/vision-raw/   one raw TSV per vision batch
data/prompts/      one prompt per batch
data/sitemap.xml   the original sitemap
images/dl/         the site's original image files — exactly the ones the report links
scripts/           the pipeline, in execution order
README.txt         how to open, structure, re-run, exclusions, key findings
```

## report.html

- **Relative paths only** — `images/dl/<file>` for every preview. The directory
  layout must survive unzipping; renaming or flattening `images/dl/` breaks every
  preview.
- **Filters and full-text search run in the browser**, from `data-hay`
  attributes and inline JS. No network, no CDN, no external fonts. A report that
  needs the internet is not an archive.
- **Previews are lazy-loaded** and only rendered when their section is opened —
  hundreds of full-size images in a collapsed appendix cost nothing until opened.
- Each finding carries a **MASSNAHME**: the action, in one line, naming what
  changes. Findings are grouped by severity, and every action names the class of
  change (server config, per-file, content decision).
- The retraction section exists and is reachable from the navigation.
- One visible page per finding group: a count, a short plain-language
  explanation, then the evidence table. Anything longer than ~30 rows is
  paginated behind a disclosure element with an explicit "… N more" line that
  points at the text twin.

## report.txt

The same findings as text, same numbers, generated from the same data in the
same run as the HTML. It exists for grep, diff and CI, and it is the fallback for
a reader whose environment blocks local files.

It is also the twin most likely to drift: a different script writes it, so it does
not automatically inherit a correction made to the HTML. See "Diffing the twins"
below for the worked example and the rule.

## README.txt

The archive guide. Sections, in this order:

1. **What this is** — target, date, one line of method.
2. **How to open it** — double-click `report.html`; relative paths, no server
   needed; `python3 -m http.server` as the fallback for a policy that blocks
   local files. No internet needed, the archive contains every image.
3. **Relational structure** — which file references which, and what breaks if it
   is renamed (`report.html` → `images/dl/…`; `html-report` reads `data/*.json`;
   `parse-vision` writes `vision.json` from `vision-raw/*.tsv`).
4. **How to re-run the pipeline** — the script list in execution order, and that
   the archive rebuilds with `sh scripts/make-zip.sh`.
5. **What is deliberately not included, and why** — raw HTML cache, empty
   directories, keys.
6. **Key findings in one line each** — the handful that carry the weight.
7. **The false-alarm note** — that the evaluation was re-checked against the raw
   data, what was withdrawn, and the warning that numbers from the earlier
   version must not be reused.
8. **Limitations** — see below.

## The report's own rules

- **Every number quoted in prose is re-derivable from `data/`.** A figure with no
  raw-data source does not ship.
- **Population and unit are stated for every aggregate.** A corpus total is not
  a user benefit: name what a visitor actually downloads. The reference run
  states outright that a 223 MB corpus figure is the corpus volume, not the
  transfer per page, and backs it with a per-page view.
- **Corpus properties are context, not findings.** "121 files have a DE and an
  EN version" is a description of a bilingual site.
- **Methodology appendix** (ANHANG D): execution steps, the script list with one
  line each, the raw-data inventory, and limitations, plus the measurement date.
- **Limitations must say**: the visual verdict is a model's judgement, not a
  human's; quote the measured scatter per criterion; name what was evaluated
  statically only (in the reference run: the 192 images excluded from the vision
  manifest as chrome) and what was excluded from the corpus (test/draft pages
  reported separately); and that only read requests were made.
- **Every count names its population.** A row count is not an image count — the
  reference's "476 images reviewed" counts verdict rows, including the 10
  duplicated rows of the retried batch, over a manifest of 466 images.

## Verification (runs before the ZIP)

`verify-html` checks the artifact's structure and paths, and a non-zero exit
blocks the archive:

| Check | Why it exists |
|---|---|
| Tag balance | a stray `</div>` silently eats the rest of the document |
| Every relative `src`/`href` resolves | a broken preview is invisible until someone clicks |
| Every rendered `<img>` preview exists | counts referenced vs. rendered per section |
| Every section id present, every nav link lands | a nav link to a missing id is a dead end |
| Card/filter counts equal the underlying records | a filter that shows fewer than exist lies |
| No unescaped quotes in `data-hay`, no raw `<`/`>` in table cells | breaks the parser or the filter |

**Not in `verify-html`: the anchor gate and the number diff** — see below.

Then the **anchor gate**, in a real browser (the one stage that needs one): click
every nav link and every in-page jump and confirm the section lands where the
source says it does. `content-visibility` on a section can swallow an anchor jump,
and no amount of reading the HTML shows it.

### Diffing the twins — the step the reference run did not have

**A separate step, not part of `verify-html`:** the two twins are generated by two
different scripts, so they drift silently unless their numbers are diffed against
each other and against the raw data. The reference run violated this, and the
HTML's own retraction section had to withdraw figures the text twin still carried:

| `report.txt` line | Still says | Correct (HTML) |
|---|---|---|
| 8640 | "spart ~223 MB" | retracted; replaced by the measured 237.1 → 45.0 MB (−81 %) |
| 8647 | "26 Bilder mit zu niedriger Auflösung" | 2 (32 of the 37 were SVG) |
| 8648 | "7 echte Copy-Paste-Fehler" | 5 |

Three stale figures in the text twin against a corrected HTML twin. The rule:
generate both twins from the same run, then diff every number that appears in
both. A figure retracted in one and live in the other is a defect in the artifact,
not a rounding difference.

Then `make-zip`, which reads the image list **out of `report.html`** so the
archive can neither contain an unreferenced file nor miss a referenced one, and
fails if the HTML links to a file that does not exist.
