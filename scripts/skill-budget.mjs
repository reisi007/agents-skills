#!/usr/bin/env node
// Pins the context cost of the *advertised* skill catalog of this repo.
// The descriptions of advertised skills sit in every session's system prompt,
// so CI fails when one of the three metrics grows above its baseline value.
//
// Usage: node scripts/skill-budget.mjs [--update]
//   0  every metric <= its pinned value (a strictly lower value prints a hint)
//   1  at least one metric is above its pinned value
//   2  usage / parse / config error (broken skill, bad baseline, unknown flag)

import { readdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, '.agents', 'skills');
const BASELINE_REL = '.github/skill-budget.json';
const BASELINE = join(ROOT, BASELINE_REL);
const METRICS = ['activeSkills', 'totalDescriptionChars', 'maxDescriptionChars'];

const fail = (msg) => {
  console.error(`skill-budget: ${msg}`);
  process.exit(2);
};

// --- frontmatter parsing -----------------------------------------------------

// The frontmatter is the block between the first `---` line and the next one.
function frontmatterLines(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '---');
  const end = start < 0 ? -1 : lines.findIndex((l, i) => i > start && l.trim() === '---');
  return start >= 0 && end > start ? lines.slice(start + 1, end) : null;
}

// Strip quotes and undo the escaping, so the length is the *delivered* text
// length (what the model sees), not the raw source bytes.
function unescapeScalar(value, file) {
  if (value.startsWith("'")) {
    let out = '';
    for (let i = 1; i < value.length; i++) {
      if (value[i] !== "'") {
        out += value[i];
      } else if (value[i + 1] === "'") {
        out += "'";
        i++;
      } else if (i === value.length - 1) {
        return out;
      } else {
        fail(`malformed single-quoted description in ${file}`);
      }
    }
    fail(`multi-line description in ${file}: keep it a single-line scalar`);
  }
  if (value.startsWith('"')) {
    if (value.indexOf('"', 1) !== value.length - 1) {
      fail(`multi-line description in ${file}: keep it a single-line scalar`);
    }
    return value.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }
  return value; // plain scalar: delivered as-is
}

function parseDescription(fm, file) {
  const key = fm.findIndex((l) => /^description:/.test(l));
  if (key < 0) fail(`missing description in ${file}`);
  const value = fm[key].slice('description:'.length).replace(/^[ \t]+|\s+$/g, '');
  // Limitation: only single-line scalars are supported. A block scalar (`|`/`>`)
  // or an indented continuation line is reported instead of guessed.
  if (value === '' || /^[|>]/.test(value)) {
    fail(`multi-line or empty description in ${file}: keep it a single-line scalar`);
  }
  const next = fm[key + 1];
  if (next !== undefined && /^[ \t]/.test(next)) {
    fail(`multi-line description in ${file}: keep it a single-line scalar`);
  }
  const description = unescapeScalar(value, file);
  if (description.length === 0) fail(`empty description in ${file}`);
  return description;
}

// `metadata:\n  opencode/autoinvoke: false` — the value may be quoted.
const HIDDEN = /^\s*(?:opencode\/)?autoinvoke:\s*['"]?false['"]?\s*$/m;

// --- measurement -------------------------------------------------------------

function measure() {
  let ids;
  try {
    ids = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(SKILLS_DIR, e.name, 'SKILL.md')))
      .map((e) => e.name)
      .sort();
  } catch {
    fail(`cannot read ${SKILLS_DIR}`);
  }
  if (ids.length === 0) fail(`no skills found in ${SKILLS_DIR}`);

  const advertised = [];
  let hiddenCount = 0;
  for (const id of ids) {
    const file = `.agents/skills/${id}/SKILL.md`;
    let text;
    try {
      text = readFileSync(join(SKILLS_DIR, id, 'SKILL.md'), 'utf8');
    } catch {
      fail(`cannot read ${file}`);
    }
    const fm = frontmatterLines(text);
    if (!fm) fail(`no frontmatter in ${file}`);
    if (HIDDEN.test(fm.join('\n'))) {
      hiddenCount++;
      continue;
    }
    advertised.push({ id, chars: parseDescription(fm, file).length });
  }

  const longest = advertised.reduce((a, b) => (b.chars > a.chars ? b : a), { id: null, chars: 0 });
  return {
    activeSkills: advertised.length,
    totalDescriptionChars: advertised.reduce((sum, s) => sum + s.chars, 0),
    maxDescriptionChars: longest.chars,
    longest,
    hiddenCount,
  };
}

// --- baseline ----------------------------------------------------------------

function readBaseline() {
  let data;
  try {
    data = JSON.parse(readFileSync(BASELINE, 'utf8'));
  } catch {
    fail(`cannot read or parse ${BASELINE_REL}`);
  }
  for (const key of METRICS) {
    if (!Number.isInteger(data[key])) fail(`${BASELINE_REL}: "${key}" must be an integer`);
  }
  return data;
}

// --- main --------------------------------------------------------------------

const args = process.argv.slice(2);
const update = args.length === 1 && args[0] === '--update';
if (args.length > 0 && !update) fail('usage: node scripts/skill-budget.mjs [--update]');

const baseline = readBaseline();
const actual = measure();

if (update) {
  const next = { note: typeof baseline.note === 'string' ? baseline.note : '' };
  for (const key of METRICS) {
    next[key] = actual[key];
    if (baseline[key] !== actual[key]) console.log(`${key}: ${baseline[key]} → ${actual[key]}`);
  }
  writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n');
  console.log(`wrote ${BASELINE_REL} — commit this on purpose`);
  process.exit(0);
}

const over = METRICS.filter((key) => actual[key] > baseline[key]);
const below = METRICS.filter((key) => actual[key] < baseline[key]);

const out = ['### Skill budget', ''];
out.push('| Metric | Pinned | Actual | Delta | Status |');
out.push('| --- | --- | --- | --- | --- |');
for (const key of METRICS) {
  const delta = actual[key] - baseline[key];
  out.push(`| ${key} | ${baseline[key]} | ${actual[key]} | ${delta > 0 ? '+' : ''}${delta} | ${delta > 0 ? 'OVER' : 'ok'} |`);
}
out.push(
  '',
  `Longest description: ${actual.longest.id ? `\`${actual.longest.id}\`` : 'none'} ` +
    `(${actual.longest.chars} chars). Hidden skills excluded: ${actual.hiddenCount}.`,
);
if (over.length > 0) {
  out.push('');
  for (const key of over) out.push(`- ${key}: ${actual[key]} > ${baseline[key]} (pinned)`);
  out.push(`- The baseline lives in \`${BASELINE_REL}\`; \`node scripts/skill-budget.mjs --update\` writes the current numbers as a deliberate commit.`);
} else if (below.length > 0) {
  out.push('', `- below budget (${below.join(', ')}): consider lowering the baseline in \`${BASELINE_REL}\`.`);
}

const block = out.join('\n') + '\n';
process.stdout.write(block);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, block);

process.exit(over.length > 0 ? 1 : 0);
