#!/usr/bin/env node
// Counts the context cost of the advertised skill catalog; ratchet owns the gate.
//
// Usage: node scripts/skill-budget.mjs <advertised-skills|description-chars-total|description-chars-max>
// Prints one count; 2 means usage or malformed skill input.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, '.agents', 'skills');

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
  return { advertised, longest, hiddenCount };
}

// --- main --------------------------------------------------------------------

const args = process.argv.slice(2);
const counters = ['advertised-skills', 'description-chars-total', 'description-chars-max'];
if (args.length !== 1 || !counters.includes(args[0])) {
  fail(`usage: node scripts/skill-budget.mjs <${counters.join('|')}>`);
}
const result = measure();
const count = args[0] === 'advertised-skills'
  ? result.advertised.length
  : args[0] === 'description-chars-total'
    ? result.advertised.reduce((sum, skill) => sum + skill.chars, 0)
    : result.longest.chars;
process.stdout.write(`${count}\n`);
