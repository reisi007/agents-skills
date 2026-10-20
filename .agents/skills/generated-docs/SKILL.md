---
name: Generated Docs
description: 'TRIGGER when a documentation file states facts that live in code or data — "generate the README from the data", "the documented commands no longer exist", "our numbers are outdated", "check the docs for drift", "which file is the source of truth for this table". NOT for prose only a person can write (rationale, product description, tone), for derived artifacts that are not documentation (that is `ratchet-gates`), for the design of quality gates itself, or for writing the feature.'
metadata:
  opencode/autoinvoke: false
---

# Generated Docs — documentation that is checked, not believed

Documentation that nobody checks is a claim. A count in a README, a status in a
feature matrix, a command in an install guide, a screenshot in a gallery — every
one of those statements ages, and it ages **silently**, because unmanaged prose
is not diffed against a source. The fix is not "write better docs". It is: name
the source of truth, generate the facts from it, and let a gate fail when the
two diverge.

The generic mechanism for derived artifacts — marker, deterministic generator,
drift gate by diff, second source of truth — lives in the `ratchet-gates` skill,
in its `references/generated-docs.md`. This skill is the case that mechanism
does not cover: **documentation and prose**.

## Who owns the claim?

The question is not "can this be generated?" but **"who owns this statement?"** —
and the answer decides the procedure.

| Claim | Owner | Procedure |
|---|---|---|
| Endpoints, commands, configuration keys, file layout, types, versions | the code | generate |
| Inventories, feature matrices, counts, statuses, result tables | a machine-readable file (manifest, inventory record, run result) | generate |
| Editorial choices — priority order, exemptions, known gaps | a person, recorded in a curated file | generate from that file |
| Why a decision was made, what the product is, how to contribute, trade-offs, tone | a person | keep it hand-written |

Generated prose reads like generated prose, and it spends the credibility that
the passages needing a human would need. For the first three rows completeness
is the actual job of the documentation; for the last row authorship is.

## What is not generated — and why

Not generated: rationale, storytelling, trade-off discussions, instructions that
embed a decision, the opening paragraph that says what the project is.

The value of these passages is the **author**, not their completeness. A
generated rationale creates a second truth about a decision somebody made — and
the version the reader sees is the version nobody owned.

**Generate facts, write reasons.**

## The drift gate

The gate answers one question: does the committed documentation still say what
the source says? The mechanism — a temporary file, a diff against the committed
one, a non-zero exit — and the ways a gate lies while staying green are in
`ratchet-gates`, in its `references/generated-docs.md`.

Three conditions make it a gate for a document:

- **The check writes nothing.** A document that the check rewrites before it
  compares is compared with itself.
- **The gate can fail.** A check that reports and stays green is not a gate.
- **Nobody regenerates before the gate.** The drift is normalised in the tree
  first, and the gate reports the change as done.

## Two truths — the central trap

The characteristic failure in documentation: a generated file carries a
**hand-maintained list** — a priority order, an exemption list, a known-gaps
list. The trap, the three ways out and what each of them costs are in
`ratchet-gates`, in its `references/generated-docs.md`.

What is specific to documents: the curated list is a source file of its own,
and the document is derived from it (`references/source-of-truth.md`).

## Numbers in prose

A number in prose is an artifact: it is generated together with the block
that owns it, or it is replaced by a reference to the generated table — a
number typed into a sentence is a copy of a fact somebody else maintains, and
it ages silently. The rule, the two ways out and the other number-shaped
artifacts are in `references/drift-and-generation.md`.

## Docs that describe things that do not exist

The worst case: the documentation claims a feature, a command or an endpoint
that is not there. A generator protects against this **only if it reads the
code**. A file that *lists* features is itself a second truth and can be as
wrong as the prose.

A list of claims therefore needs its **own** gate: every named thing exists and
is reachable. Or it is derived from the code — and then it is not a list of
claims but a projection of the code.

## Mixed files

Legitimate: a generated block (a table, numbers, an inventory) inside a
hand-written document. Three rules make it safe:

- The block is **marked**, and the generator **recognises** it — otherwise the
  next run overwrites the hand-written text, or is overwritten by it.
- The hand-written file owns the hand-written text, the generated file owns the
  block. That is **two sources for two different statements**, not two sources
  for the same statement. This distinction is the whole difference.
- The gate checks the **whole file**, not just the block — so a generator that
  overwrites the hand-written text around the block shows up in the diff.

## Core rules

1. A claim without an owner is a claim without a maintainer — decide the owner
   before the text is written.
2. Facts are generated, reasons are written; a generated rationale is a second
   truth about a human decision.
3. The drift check is a diff against the committed file, and it overwrites
   nothing.
4. A gate that cannot fail is a report, not a gate — a documentation check that
   always reports green is worse than none, because it looks like coverage.
5. A curated list inside a generated document is a second source of truth —
   the ways out are in `ratchet-gates`.
6. A number in prose is an artifact: generate it in the block, or drop the
   number and point at the generated table — never type it.
7. A list of claims about the product needs its own gate — a generator reading
   the code protects only what it reads.

## Checklist — documentation that gets generated

1. Inventory the claims: every sentence of the document that states a fact.
2. Per claim, name the owner: the code, a machine-readable file, a curated
   list file, or a person.
3. Name the source path and verify it exists in a clean checkout.
4. Generate the facts only; leave rationale hand-written.
5. Put marker and regeneration command into the file, or into the generated
   block.
6. Wire the gate as a diff against the committed file; let it fail on a
   difference.
7. Keep the generator deterministic — the rules are in `ratchet-gates`; a
   document that reshuffles on every run trains people to ignore the diff.
8. Move priority order, exemptions and known gaps out of the document into a
   curated source file.
9. Numbers in prose: generate them in the block or replace them with a
   reference.
10. Give a list of claims its own gate, or derive it from the code.
11. Mark generated blocks inside hand-written documents.

## Reference files

- `references/source-of-truth.md` — how the source of truth is determined, which
  artifacts may serve as a source and which may not, code versus hand-written
  file as source, documentation of things that do not exist.
- `references/drift-and-generation.md` — generator design, markers, the drift
  gate by diff, determinism, what must not be generated, mixed documents, the
  two-truth trap, numbers in prose.
