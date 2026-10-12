// templates/fp-audit.mjs — the false-positive audit of your own rules.
//
// Copy to <project>/scripts/fp-audit.mjs, then adapt the ADAPT comments: schema
// field names, finding codes, regexes and thresholds are project-specific, the
// QUESTIONS are not. Plain `node`, no dependencies. Exit code is always 0 —
// this is a report you read, not a gate that fails the build.
//
// Reads (project root = one level above this file):
//   data/images.json   one record per unique image (shape below)
//   data/findings.json { findings[], pageFindings[], <grouping datasets> }
//   data/vision.json   { items: [{ file, issue, alt_match, score, ... }] }
//
// EVERY COUNTER BELOW RUNS THROUGH ONE MECHANISM: it prints either a number
// together with the field or code it read, or an explicit "ABSENT — adapt" line.
// Never a bare 0. A zero that could just as well mean "this schema has no such
// field" is the "a line with the number 0 proves nothing" trap this file exists
// to prevent. A zero WITH a note is a finding; a zero without one is the trap.
//
// EXPECTED RECORD SHAPE of data/images.json (adapt the names, keep the roles):
//   { src, fileName, file, format, width, height, bytes,
//     cacheControl, contentType, httpStatus,
//     kinds: ['img'|'source'|'css-bg'|'og-image'|'twitter-image'],
//     refs: [{ page, status, kind }], altValues: [...], classSample, ... }
//   ... plus whatever the context stages added in place (boxReserved, ...).
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).href.replace("file://", "").replace(/\/?$/, "/");
const read = (p) => (existsSync(ROOT + p) ? JSON.parse(readFileSync(ROOT + p, "utf8")) : null);

const imgs = read("data/images.json") || [];
const F = read("data/findings.json") || {};
const findings = F.findings || [];
const pageFindings = F.pageFindings || [];
const vision = read("data/vision.json") || { items: [] };

const bySrc = new Map(imgs.map((r) => [r.src, r]));
const has = (r, key) => r != null && Object.prototype.hasOwnProperty.call(r, key);
const cnt = (code, list = findings) => list.filter((f) => f.code === code);
const recs = (list) => list.map((f) => bySrc.get(f.image)).filter(Boolean);
const line = (s) => console.log(s);
const ask = (s) => line(`      ASK: ${s}`);

// ── the one mechanism: a number with its source, or an explicit ABSENT ──────
const absent = (label, source, why) =>
  line(`   ${label}: 0  ABSENT — ${source}${why ? ` (${why})` : ""} is not in the data — adapt this check before reading it as zero defects`);
const counter = (label, n, source) => (n ? line(`   ${label}: ${n}  [${source}]`) : absent(label, source));
const codeCount = (code, list = findings) => {
  counter(code, cnt(code, list).length, `code "${code}"`);
  return cnt(code, list).length;
};
// Inverted semantics: here a zero means the collector never wrote the key, so a
// check reading that key measures nothing — that IS the finding.
const population = (key) => {
  const n = imgs.filter((r) => has(r, key) && r[key] !== null && r[key] !== undefined).length;
  line(`   ${key}: populated on ${n} of ${imgs.length} records`);
  if (n === 0) line("      !! RULE INVALID — the collector never wrote this key, so any check reading it measures nothing");
  return n;
};
// A vocabulary VALUE that matches zero records is not a missing FIELD. The two
// are different faults with different fixes, so they must read differently:
//   value absent, field populated -> the vocabulary list is stale or a parse
//     step remapped the value upstream (the reference maps wrong-language to
//     superseded) -> fix the list, not the collector.
//   field absent (nothing collected)  -> the collector never wrote the key ->
//     the check measures nothing, same wording as population() above.
// Both end on the same operative point: never read this as zero defects.
const vocab = (field, expected) => {
  const seen = {};
  let collected = 0;
  for (const v of vision.items) {
    const k = String(v[field] ?? "").toLowerCase();
    if (k) {
      seen[k] = (seen[k] || 0) + 1;
      collected++;
    }
  }
  for (const e of expected) {
    if (seen[e]) line(`   ${field}=${e}: ${seen[e]}  [vision.items[].${field}]`);
    else if (collected) line(`   ${field}=${e}: 0  VALUE ABSENT — ${field} carries data but not this value. ` +
      `Check the vocabulary: a parse step may remap it. Adapt the list; do not read this as zero defects.`);
    else line(`   ${field}=${e}: 0  FIELD ABSENT — no item carries '${field}', the collector never wrote it. ` +
      `A check reading it measures nothing. Do not read this as zero defects.`);
  }
  line(`      ${field}: populated on ${collected} of ${vision.items.length} items` +
    ` | values present: ${Object.keys(seen).sort().join(", ") || "(none)"}`);
};

// ── A. alt text ────────────────────────────────────────────────────────────
// ADAPT: the codes below are the reference run's.
line("═══ A. ALT TEXT — is the criterion applicable to these records? ═══");
for (const code of ["ALT_MISSING", "ALT_EMPTY"]) {
  const r = recs(cnt(code));
  const n = codeCount(code);
  if (n) {
    line(`      not an <img>: ${r.filter((x) => !x.kinds?.includes("img")).length} of ${n}` +
      ` | vector: ${r.filter((x) => x.format === "svg").length} of ${n}`);
  }
}
codeCount("ALT_ARIA_HIDDEN");
ask("which of these records cannot carry an alt attribute at all? (metadata / CSS background)");
ask("does the verdict distinguish all-empty / some-filled / any-filled? was 'text next to image' checked BEFORE 'decorative'? (order)");

// ── B. dimensions / layout shift ───────────────────────────────────────────
line("\n═══ B. DIMENSIONS — does a missing attribute cause a shift here? ═══");
// ADAPT: both codes are the reference run's. IMG_NO_DIMS was RETRACTED there,
// so it prints ABSENT — which is the point: the check must not read as zero.
codeCount("IMG_NO_DIMS");
codeCount("IMG_BOX_UNRESERVED");
if (population("boxReserved")) ask("is the box reserved anywhere near the tag? how many hits are <noscript>-only?");
else ask("box reservation is not carried in the dataset — the shift criterion has no evidence either way");

// ── C. field population / srcset / formats ─────────────────────────────────
line("\n═══ C. FIELD POPULATION — does the check read a key that exists? ═══");
// ADAPT: every key any rule reads.
for (const key of ["degenerateSrcset", "usableSrcset", "srcsetCandidates"]) population(key);
const fakesrc = recs(cnt("IMG_FAKE_SRCSET"));
line(`   IMG_FAKE_SRCSET: n=${fakesrc.length} | of which actually offer distinct files: ${fakesrc.filter((x) => x.usableSrcset).length} of ${fakesrc.length}`);
codeCount("IMG_LEGACY_PHOTO");
codeCount("LEGACY_FLAT_OK");
ask("are photos and flat graphics separated before recommending a container?");

// ── D. resolution / size thresholds ────────────────────────────────────────
// ADAPT: codes, field names and thresholds are the reference run's.
line("\n═══ D. RESOLUTION & SIZE — measured parameter, or habit? ═══");
const lowres = recs(cnt("IMG_LOW_RES"));
codeCount("IMG_LOW_RES");
line(`      of which vector (criterion checks nothing there): ${lowres.filter((x) => x.format === "svg").length} of ${lowres.length}`);
// ADAPT: 'width' is the reference schema's field name.
const widths = imgs.map((x) => x.width).filter(Boolean).sort((a, b) => a - b);
const median = widths.length ? widths[Math.floor(widths.length / 2)] : null;
ask(`what distribution produced this threshold? median width=${median ?? "n/a"}px over n=${widths.length} records [images.json[].width]`);
ask("was any saving estimated with an assumed ratio instead of a measured one?");

// ── E. grouping / aggregation ──────────────────────────────────────────────
// ADAPT: 'altValues' and 'dupAlts' are the reference run's schema/dataset names.
line("\n═══ E. GROUPING — does the aggregation double-count? ═══");
const occ = imgs.flatMap((r) => (r.altValues || []).filter(Boolean));
const distinct = new Set(occ).size;
const foldedDistinct = new Set(occ.map((s) => s.toLowerCase())).size;
counter("alt value occurrences", occ.length, "images.json[].altValues");
counter("alt values: distinct (case-sensitive)", distinct, "images.json[].altValues");
counter("alt values: distinct (case-folded)", foldedDistinct, "images.json[].altValues");
line(`      folding merges ${distinct - foldedDistinct} of the ${distinct} distinct values` +
  `; the same text on N pages counts once, not N times (${occ.length - distinct} repeats)`);
const groups = F.dupAlts || [];
const foldedGroups = new Map();
for (const g of groups) foldedGroups.set(String(g.alt).toLowerCase(), (foldedGroups.get(String(g.alt).toLowerCase()) || []).concat(g));
counter("grouping dataset: groups as reported", groups.length, "findings.json.dupAlts");
counter("grouping dataset: groups when case-folded", foldedGroups.size, "findings.json.dupAlts");
for (const [k, v] of foldedGroups) if (v.length > 1) line(`      FOLDED MERGE: "${k.slice(0, 48)}" <- ${v.map((x) => x.count).join(" + ")}`);
ask("was the grouping case-sensitive? do language twins count as two groups?");
ask("is the language assignment resolved before variants are counted?");

// ── F. vision findings — the circularity test ──────────────────────────────
line("\n═══ F. VISION FINDINGS — circular, or independent evidence? ═══");
// ADAPT: list every issue value that was present in the prompt as context — an
// agent repeating a value it was given returns your input, not an observation.
const CIRCULAR = new Set(["oversized", "low-res"]);
const issues = {};
for (const v of vision.items) if (v.issue) issues[v.issue] = (issues[v.issue] || 0) + 1;
for (const [k, v] of Object.entries(issues).sort((a, b) => b[1] - a[1])) {
  line(`   ${CIRCULAR.has(k) ? "CIRCULAR " : "plausible"} ${String(v).padStart(3)}  ${k}`);
  if (CIRCULAR.has(k)) line("      -> belongs to the static analysis, not to the image review");
}
// ADAPT: the vocabulary below must match what the parse step actually emits.
// The reference remapped "wrong-language" to "superseded" after refuting all 18
// cases — so a check still asking for "wrong-language" can only ever print 0.
vocab("alt_match", ["superseded", "wrong-language", "mismatch"]);
ask("was the language assignment in the prompt? if not, how many survive the sound check?");

// ── G. page findings ───────────────────────────────────────────────────────
line("\n═══ G. PAGE FINDINGS ═══");
const pc = {};
for (const f of pageFindings) pc[f.code] = (pc[f.code] || 0) + 1;
line("   " + Object.entries(pc).map(([k, v]) => `${k}=${v}`).join(" "));
codeCount("TITLE_TRUNCATED", pageFindings);
codeCount("META_TRUNCATED", pageFindings);
// ADAPT: the reference carries the length inside msg, not in a field. Extract it
// from the message if that is where your pipeline puts it — and prefer adding a
// real field, so this check never has to parse prose.
const LEN = /(\d+)\s*(?:Zeichen|chars?|characters)/i;
const lens = (code) =>
  cnt(code, pageFindings).map((f) => Number(LEN.exec(f.msg || "")?.[1])).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
const tl = lens("TITLE_TRUNCATED");
const ml = lens("META_TRUNCATED");
const spread = (a) => (a.length ? `n=${a.length} median=${a[Math.floor(a.length / 2)]} max=${a.at(-1)}` : "0  ABSENT — no length recoverable from the data (carry it in a field, not in msg)");
line(`   title lengths: ${spread(tl)}`);
line(`   description lengths: ${spread(ml)}`);
if (tl.length) ask(`the threshold that fires on these lengths — measured from this median, or carried over from habit?`);
ask("does the population contain drafts and test pages? report them as their own finding, not inside another count");

line("\n── rule: a retracted check is REMOVED or REPLACED by a real finding, never left as a number ──");
