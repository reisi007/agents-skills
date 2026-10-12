# Pipeline — stage by stage

The pipeline stages are scripts in `scripts/`, runnable in order with plain
`node` and **no external dependencies**. A stage reads only what earlier stages
wrote, so the whole pipeline is re-runnable and each artifact is re-derivable.
Role names below, not the reference run's file names.

One step sits outside that claim: the **anchor gate** — proving that a jump to a
section actually lands and is not swallowed by `content-visibility` — needs a
real browser. The reference implemented it with Playwright, and it is the only
browser-dependent stage. Everything else, including the false-positive audit, is
plain Node.

## Ordering constraint (the only hard one)

```
collect → analyze → vision (fan-out + parse) → context reconstruction
        → fp-audit  →  report / html-report  →  verify-html  →  make-zip
```

**The false-positive audit runs before report generation.** The report's numbers
*and* its retraction section are outputs of that audit, not of `analyze`. A
report generated before the audit is the state the reference run had to retract.

Everything else can be iterated: re-running `report` after a correction is
expected. Re-running `crawl` or `download-images` invalidates everything
downstream — do it deliberately, and re-run the audit afterwards.

## Stages

| Role | Reads | Writes | Contract |
|---|---|---|---|
| `parse-sitemap` | `data/sitemap.xml` | `data/urls.json` | one de-duplicated URL per line of the original sitemap; the original XML is kept verbatim as served on the run date |
| `crawl` | `data/urls.json` | `data/pages.json`, `data/cache/*.html` | cap parallelism, retry failures, browser-like User-Agent, decode HTML entities. Stores every image reference found, with its `kind` |
| `download-images` | `data/pages.json` | `images/dl/`, `data/images.json` | one record per unique image URL; format + pixel dimensions read from the **binary headers**; bytes + response headers; content-hash the file, never trust the URL or file name as an identity proof |
| `analyze` | `data/images.json`, `data/pages.json`, context outputs | `data/findings.json` | rules emit `{severity, code, msg, image|page}`; codes are stable; each rule states measured vs. inferred |
| `vision-manifest` | `data/images.json` | `data/vision-batches.json` | damage-prioritised candidate list, chunked ~10 per batch; chrome/tiny/vectors excluded unless a question targets them |
| `gen-prompts` | `data/vision-batches.json` | `data/prompts/*.txt` | one prompt file per batch, replayable; contains **no measurement you later want to treat as evidence** |
| (subagents) | `data/prompts/*.txt` | `data/vision-raw/*.tsv` | raw, unparsed, one file per batch; failed batches re-run and kept under their own name |
| `parse-vision` | `data/vision-raw/*.tsv`, `data/images.json` | `data/vision.json` | TSV → records joined by file name. Drops rows whose file name is unknown — and must **count** what it drops, or an unknown file silently loses its verdict (the reference does not count; see `vision-batches.md`) |
| `alt-by-page` | cache + `data/images.json` | `data/alt-by-page.json` | recovers **alt text per page and per language** — a de-duplicated value list destroys the page→alt mapping and manufactures false "multilingual" findings |
| `label-context` | cache + pages | `data/label-context.json` | per `<img>`: does visible text sit next to it. Window size is **measured**, not assumed |
| `box-reserved` | cache | `data/images.json` (fields) | reads a ±300/400-character CSS window around each tag (a sibling/ancestor proxy, not a real ancestor chain) for `padding-top` / `aspect-ratio` / `height`; counts distinct URLs in a `srcset` |
| `fp-audit` | `data/images.json`, `data/findings.json`, `data/vision.json` | stdout | rule-group audit, sections A–G; runs **before** `report`, never after it |
| `report` | all of `data/` | `report.txt` | text twin, same findings, grep/diff/CI-able |
| `html-report` | all of `data/` | `report.html` | main artifact; relative `images/dl/…` paths; filters + full-text search in the browser, no network |
| `verify-html` | `report.html`, `data/*.json` | stdout, non-zero exit | structure + path + preview + section-id + nav-link + card-count checks; **not** the prose-number check (see `report-contract.md`) |
| `make-zip` | `report.html` | `report-<slug>.zip` | reads the image list **out of the HTML**, so the archive can neither contain an unlinked file nor miss a linked one |

## Data files and what each must contain

| File | Must contain |
|---|---|
| `data/sitemap.xml` | the original sitemap as served on the run date |
| `data/urls.json` | the de-duplicated URL set actually crawled |
| `data/pages.json` | per page: URL, HTTP status, title, meta description, canonical, h1, and every image reference with its `kind` |
| `data/images.json` | per unique image: URL, referencing pages, reference kinds, alt values, `loading`, intrinsic and attribute dimensions, format, bytes, `content-type`, `cache-control`, HTTP status, local file name, plus the context fields (`boxReserved`, `degenerateSrcset`, …) |
| `data/findings.json` | `findings[]` (image-level), `pageFindings[]` (page-level), and the grouping datasets the rules produced (`dupAlts`, …) |
| `data/vision.json` | one record per vision verdict: file, score, type, content/decorative, `alt_match`, issue, suggested alt, batch id |
| `data/vision-raw/*.tsv` | one raw file per batch — the unmodified agent output |
| `data/prompts/*.txt` | one prompt per batch |
| `data/alt-by-page.json` | alt variants per file with pages and languages, and the per-language assignment |
| `data/label-context.json` | per image: adjacent visible text or its absence, with the window used |
| `data/cache/` | raw crawled HTML — a working product, **never shipped** |

Two rules about the data files:

1. **No key, no check.** A rule that reads `srcset` must be able to prove the
   field exists in the records it reads. `0 of 659 records had the key` is the
   reference run's "317 images without srcset" — a collector bug reported as a
   finding. `fp-audit.mjs` prints the population count for the fields it names in
   section C, and every other counter it prints carries the field or code it read.
2. **Raw before derived.** Every derived file is regenerable from the raw ones.
   Keep the raw agent output as TSV, not as a summary. Note what "raw" covers:
   `data/cache/` (the crawled HTML) and `data/vision-raw/*.tsv` are raw;
   `images.json` is **not** — the context stages write their fields back into it
   in place (`boxReserved`, `inNoscript`, `degenerateSrcset`, …), so re-running a
   context stage mutates the same file the download stage produced. That is a
   deliberate trade of the reference run: it keeps one file per image instead of
   three, at the price that `images.json` is no longer a pure download record.
   Either keep the write-back and say so, or keep the context results in their own
   file — both are defensible, a silent in-place rewrite is not.
   And the context stages read `data/cache/`, which the archive excludes: the
   pipeline is only re-runnable while the cache is kept in the project directory,
   never inside the delivered ZIP.

## What must NOT be in the artifact

| Excluded | Why |
|---|---|
| `data/cache/` (raw HTML) | intermediate product of no use to a reader; in the reference run it outweighed everything the archive carries |
| Empty directories | an empty `reports/` reads as a missing deliverable |
| TLS keys, credentials, tokens | never write them into the project directory at all |
| Images the report never references | the ZIP is built from the report's own reference list |
| Generated thumbnails standing in for originals | `images/dl/` holds the site's real files; a preview must be inspectable at full size |
| A number without a source | every figure in prose is re-derivable from `data/` |

The test for the archive: unzip it on a machine with no network, double-click
`report.html`, and every preview, filter and anchor still works.
