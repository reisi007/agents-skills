# Generated docs — one source of truth, no parallel maintenance

Everything derived is generated. Nothing derived is maintained in parallel.
A derived artifact that is written by hand and by a generator is two sources
of truth, and the reader cannot tell which one is current.

## The anatomy of a generated file

```
GENERATED FILE — DO NOT EDIT BY HAND
Source:   <path to the source artifact>
Regenerate: <the command that rewrites this file>
```

Three requirements, all checked by the drift gate:

1. **The marker is present.** The header states that the file is generated and
   names the regeneration command. A reader who opens the file learns this
   before reading the first number.
2. **The command works from a clean checkout.** It needs no manual step, no
   editor, no prior state. If it does not work, the file is hand-maintained in
   practice and the marker is a lie.
3. **The source is named.** One path, unambiguous.

## One source, two readers

The gate and the report read the **same artifact**. If the gate counts from
the generator's output while the report prints a table that was copied into a
markdown file, the two can disagree — and the reader has to guess which is
right. That is not a cosmetic issue: a contradiction between "the gate says
green" and "the doc says 47 violations" destroys trust in both.

The source of truth is the *input* of the generator (the code, the manifest,
the inventory). The generated file is a view of it, not a place to record
things.

## Deterministic generators

A generator that produces different bytes for the same input makes the drift
gate flaky. A flaky gate is muted within weeks, and a muted gate is worse than
none — it looks like coverage.

Rules:

- **Sorted output.** Every list, every table, every index — sorted by a total
  order, never by filesystem or map iteration order.
- **No timestamps.** "Generated on 2026-04-17" changes on every run. The
  commit history already records when.
- **No absolute paths, no machine names, no environment values.**
- **No random identifiers** — stable ids derived from the content.
- **Stable formatting.** The same content renders byte-identically; no
  trailing-whitespace drift, no locale-dependent number or date formatting.

The test is trivial and belongs in the merge pipeline: run the generator
twice into two temporary files and diff them — the diff must be empty. A
generator that fails this test is not ready to be gated.

## The drift gate is a diff

The check regenerates into a **temporary file** and diffs it against the
committed one. It does not regenerate in place: overwriting the committed file
turns the check into "the next commit carries the change", which is silent
review and hides the drift until it lands.

The diff output must be readable — the gate prints the changed lines, so a
reviewer sees what the source moved to. "the generated file differs from the
source" is a report; "line 42: 12 → 11" is a diagnosis.

Order of operations: fix the source, regenerate, commit the regenerated file
**in the same commit**. A generated file that is out of date in the tree makes
every later diff harder to read.

## The second source of truth

The characteristic failure: a generated file that contains a **hand-maintained
list** — a priority ordering, an owner list, an exemption list, a set of
known exceptions. It looks like ordinary content of the generated file, so
people edit it there. The next regeneration deletes the edit, silently, and
the list is gone.

Three ways out:

| Option | Cost |
|---|---|
| The list lives in the source and the generator reads it | none — this is the default |
| The list lives in a separate source file that the generator merges in | one more file, still one truth per fact |
| The generator preserves a delimited block in the output | the block is a second truth with extra steps: it must still be diffed against its own source |

Prefer the first. The third is a trap: a preserved block looks like it
belongs to the generated file, so the next person edits it and the drift
gate does not notice — the block is not compared against anything.

**Exemptions are data.** A list of allowed exceptions belongs in the source
(the generator applies it), and it is reviewed like code: the exemptions
themselves can go stale, and a stale exemption hides a violation forever.

## Numbers in prose

A sentence like "the project has 42 modules, 90 % of them tested" is a
hand-maintained copy of a generated number. It drifts silently, because prose
is not diffed against a source by anything.

Two clean options:

- **Generate the sentence.** The prose file is generated too, with the same
  marker and the same command. The generator writes the number from the
  source; nobody types it.
- **Replace the number with a reference.** Point at the generated table
  instead of repeating its content: "the inventory is in
  `<generated file>`". The prose stays true because it carries no number.

What not to do: a number in prose with no marker and no reference. It is a
claim nobody maintains, and it will be wrong in exactly the place a reader
trusts.

The same applies to headings, badges and captions that encode a number
("87 % coverage", "12 open findings"): they are artifacts. Either they are
generated or they are dropped.
