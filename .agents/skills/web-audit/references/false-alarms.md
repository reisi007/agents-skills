# False alarms — the audit of your own rules

The reference run's first pass was not careless. Every rule fired exactly as
written, every number was traceable to the data. It was still wrong, because it
reported **what it measured** instead of **what was wrong**: a missing attribute
is a measurement, a missing attribute that causes nothing is a false alarm. The
audit against the raw data withdrew ~20 findings. Several were 100 % false
alarms; one check measured a field that was never populated; one "savings"
figure assumed a compression ratio nobody had measured. In the same pass the
totals moved from 425 errors to 587 errors *with different content* — a bigger
number that was also a better report.

Eight cause classes cover all of it. They are ordered by how much damage they
did.

---

## 1. Wrong element class — the criterion does not apply to these records

**Definition.** The rule was applied to elements for which the criterion has no
defined meaning, because the population was never split by element class.

| Reported | Reality | Rule |
|---|---|---|
| "69 images without alt" | **100 % false alarm → 0.** All were `og:image` metadata and CSS background images. No `<img>` exists there, so `alt` is not applicable. | Split by reference kind before counting: `<img>`, `<picture>/<source>`, CSS background, `og:image`, `twitter:image`. Only `<img>` (and elements with an implicit role) carry `alt`. |
| "37 images with too low a resolution" | **32 were SVG.** A vector is sharp at any size; the criterion checks nothing there. | Exclude vectors from raster criteria. Narrowed: **2** instead of 37. |
| "353 images in outdated formats" | Mixed photos with flat graphics. **122 (35 %) are correctly stored as PNG/JPEG**, where WebP is not lossless. | Classify photo vs. flat graphic (bits per pixel, colour count) before recommending a container. Split: **86 photos in the wrong container** (warning) + **267 correctly stored flat graphics** (hint). |
| "WebP lossless for graphics" (the usual advice) | Counter-probe on the real files: **267 files would grow +111 %** (36.9 MB vs. 17.5 MB). | Run the popular recommendation as a counter-probe before printing it. |
| "14 pages without H1" | **6 are test pages** (`-donotpublish-`, `/asfd`). | Clean the population of drafts and test records first, and report them as their own finding. **8 real deficits** remain. |

## 2. The cause is elsewhere — the attribute is not the mechanism

**Definition.** The rule named an attribute as the cause of an effect that the
site prevents by other means, so the measurement was right and the conclusion
was wrong.

| Reported | Reality | Rule |
|---|---|---|
| "562 images without width/height → layout shift" | **100 % false alarm.** **3246 of 3308** `<img>` tags sit `position:absolute` inside a wrapper that reserves the box via `padding-top:63.21%`, `height` or `aspect-ratio` in ancestor CSS; **91 %** of the hits appear only in the `<noscript>` fallback. The box stands before the image loads. | Prove the box is unreserved *anywhere in the ancestor chain* before calling a missing attribute a shift. Check removed; the genuine case that survived the audit is its own finding (1 image). |

## 3. Field never populated — the check measures nothing

**Definition.** The rule read a key the collector never wrote, so it counted
zero-population as a defect. The finding is a bug report about the pipeline.

| Reported | Reality | Rule |
|---|---|---|
| "317 images without srcset" | **0 of 659 records had the key.** The check measured nothing. | Every rule must print how many records carried the field it read. Replaced by a real finding: **419 images have a degenerate srcset** naming the same file for all 8 width candidates — worse than no srcset, because the phone downloads the original while the attribute pretends responsive images. |

## 4. Habit parameter instead of a measured one

**Definition.** A threshold, window or ratio was carried over from habit or from
a generic checklist instead of being derived from this corpus or measured on
these files.

| Reported | Reality | Rule |
|---|---|---|
| "84 too-long titles / 177 too-long meta descriptions" | Thresholds of 70/175 chars flagged pages barely over as well as one **827-character** page. Measured distribution: median **40 / 143**. Corrected to the real cut-off, **100 / 300**: **13 titles and 78 descriptions** actually get truncated; the marginal cases stay as hints. | Measure the distribution, then set the cut-off. Report the median next to the threshold so the reader can see where it came from. |
| "saves 223 MB" | Methodologically wrong three ways: **100 %** compression assumed instead of the measured **81–85 %**; non-convertible SVG and already-converted WebP counted in; the corpus total presented as user benefit. | Compute every derived quantity from measured per-file values on the real files (the reference run re-encoded with an image library), and state which population and which unit the reader gets. Replaced by **237.1 MB → 45.0 MB (−81 %)**, plus a per-page view. |
| "text next to the image" search window = 900 characters | On a quote image the caption sits **1370 characters** away, because the framework embeds a 1.2 kB quotation-mark `<svg>` in between. Widened to **2600** → **56 cases** corrected from "unlabelled" to "labelled". | Measure the window against the corpus and widen until the count stops moving. A silently truncating window manufactures unlabelled images. |

## 5. Aggregation and normalisation bug — the grouping changes the population

**Definition.** Records were matched or grouped with a normalisation the data
does not support, or a verdict that can only say "all" or "any", so the count
describes the grouping rather than the corpus.

| Reported | Reality | Rule |
|---|---|---|
| "16 groups of duplicate alt texts" | Grouping ran **case-insensitively**, so German/English twins counted as two groups and every defect was double-counted. After matching against image content and the vision verdicts: **5 real copy-paste errors**. | Match on the identity you mean. Case-insensitive grouping is only safe when case carries no information. |
| "136 files with more than one alt-text variant" | A different metric from the 121-file figure above, and not an error at all: after resolving via the language assignment, **129 are normal DE/EN variants** (correct). Left: **1 inconsistent**, **37 missing translations**. | Resolve the language assignment before counting variants; a variant per language on a bilingual site is the correct implementation. |
| "32 files with partial fill" | Fell through the net because the verdict only tested "all empty" or "any filled". | Verdicts distinguish all / none / some. Now its own code, `ALT_PARTIAL_FILL`. |
| Language detection via word lists | Ran case-insensitively and counted German compound nouns as an English signal. | Case-sensitive matching. Very short texts stay deliberately unmarked instead of guessed. |

## 6. Order dependency between checks

**Definition.** Two rules overlap; which one runs first decides the severity of
the result, so the output depends on an accident of code order.

| Reported | Reality | Rule |
|---|---|---|
| "text next to the image" evaluated **before** "decorative" | Escalated **35 small icons** from hint to warning. | The most specific exclusion runs first. The precedence order is part of the rule set — version it and pin it with a test. |

## 7. Correct behaviour reported as a defect

**Definition.** The site implements the standard correctly and the criterion is
wrong. These are the most embarrassing class, because the number is real and
only the interpretation is inverted.

| Reported | Reality | Rule |
|---|---|---|
| "121 files with DE and EN version" | Not a finding. A German text on German pages and an English one on English pages is the correct implementation. **120 of 121 correct, 1 really inconsistent.** | Name the standard the behaviour violates. If the site's bilingual design is the reason for the pattern, the criterion is wrong, not the site. |
| "121 multilingual files" as an error count | Removed as a count; kept as context only. | A property of the corpus is not a finding. |
| "19 files with `aria-hidden="true"`" | Reported as errors although the attribute deliberately hides the image from screen readers — **empty alt is the intended pattern** there. | Demoted to a hint. Check the accessibility intent of an attribute before treating its consequence as a defect. |
| "2 images without loading=lazy" | Both `loading="eager"` **hero images**, i.e. LCP candidates. Lazy loading would *hurt*. Check removed. | `loading=lazy` is a recommendation, never a rule — for anything above the fold it is the wrong advice. |

## 8. Circular evidence — the agent echoes your own metadata

**Definition.** The vision pass reported something that was already in its
prompt, or concluded a fact it was never given. The output looks like a finding
and is only your input returned.

| Reported | Reality | Rule |
|---|---|---|
| "95 vision reports of oversized / low-res" | Dimensions and file size were handed to the agent in the prompt, so it mirrored the input back. These claims come from the static analysis, not from looking at the image. 15 of the 69 "oversized" reports concern files under 100 KB, six of them logos. | Never feed a measurement into a prompt if you want the verdict to count as independent evidence. |
| "18 vision reports of alt text in the wrong language" | **All 18 refuted.** The model flagged German alt on German pages because the same file also serves English pages — it was never given the page→language assignment. | The sound check (per-page language mapping) yields **1 case**. Give the agent the assignment, or drop the question. |
| Quality score average **3.80 / 5** | Measured scatter over 10 double-scored images: mean Δ**0.50**, max **2 points**; the alt verdict agreed **10/10 = 100 %**, the defect category **6/10 = 60 %**. | Publish per-criterion agreement before publishing any score. The alt verdict is load-bearing (P1 measures rest on it); the score is a ranking hint, not a measurement; the category is orienting. |

---

## The published-retraction principle

The report lists what it withdrew, why, and what the corrected number is. Not as
an apology — as part of the deliverable. A reader who sees only the final numbers
re-produces the same false alarms, and the next auditor repeats the work. The
reference run's report carries the withdrawal as its own section, next to the
classification of what is directly measured (`BELEGT`), what is pattern-based
(`HEURISTIK`, right population, individual cases possibly wrong), and what was
retracted (`ZURÜCKGENOMMEN`).

Two corollaries:

- **A check that is retracted is removed or replaced by a real finding — never
  left as a number.** "562 images without width/height" does not become
  "0 images without width/height"; the section disappears, and if something real
  survives (1 genuinely unreserved box), that something is its own finding.
- **A line with the number 0 proves nothing.** A check that found nothing earns no
  section unless the zero *is* the finding.

## Mechanics of the audit script

`templates/fp-audit.mjs` is the project-neutral skeleton; copy it to
`scripts/fp-audit.mjs` and adapt the schema field names and thresholds. It
re-reads the raw data — `data/images.json`, `data/findings.json`,
`data/vision.json` — and re-examines each rule group, printing the questions the
group must answer rather than the answers. Sections:

| § | Rule group | The question it forces |
|---|---|---|
| A | alt text | Are these content images at all? population by format, size, page reach, CSS class; do the counts hold for *all/any/some*? |
| B | dimensions | Does the missing attribute cause a shift here — is the box reserved in an ancestor? How many of the records are vectors or non-`<img>` references? |
| C | srcset / formats | Does the dataset even contain the field the check reads? How many records have the key? Are photos and flat graphics split? |
| D | resolution / size | Are vectors in the population? Are the thresholds measured against this corpus? |
| E | duplicate alt texts | Was the grouping case-sensitive? Are DE/EN twins being counted twice? Is the language assignment resolved? |
| F | vision findings | Which verdicts were told to the agent in the prompt (circularity test)? Which conclusions were drawn without an assignment? What is the per-criterion agreement? |
| G | page findings | Are the thresholds measured? Does the population contain drafts and test pages? |

Run the rule groups **as parallel subagents — one agent per rule group** — alt
text / CLS+performance / formats+sizes / vision findings / duplicates+pages. Each
with the raw data and the group's rules in front of it, each reporting back:
retract, correct, or keep — with the number that changes.

Every counter in the audit script must print either a number together with the
field or code it read, or an explicit "ABSENT — adapt" line. Never a bare 0: a
zero that could also mean "this schema has no such field" is the same trap as a
finding that was never populated. Two of the reference run's own checks died
exactly there — one counted a vocabulary value the parse step had already remapped
(`wrong-language` → `superseded`), another read a field the collector never wrote
(`srcset`, 0 of 659 records).

## Retry duplication — the count inflated by keeping the retry

Not one of the eight classes, but it belongs next to them. A retried batch kept
under its own file name is correct practice for the raw record, and wrong for
every count derived from it: the 10 rows of the retried batch appear twice, so
`data/vision.json` holds **476 verdict rows for 466 manifest images**, and the
report's "476 images reviewed" is the row count, not the image count. The rule:
de-duplicate by image before counting, and state which population a figure is
derived from — every count names its population.
