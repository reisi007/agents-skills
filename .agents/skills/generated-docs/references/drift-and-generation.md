# Drift and generation — the mechanics for documents

The generic mechanism for derived artifacts — marker, deterministic generator,
drift gate by diff, second source of truth — is described in the `ratchet-gates`
skill, in its `references/generated-docs.md`. This file adds what is specific to
documents: prose around the facts, blocks inside hand-written files, and the
claims a document makes about the product.

## The generator

One command, one output, named in the file it produces and runnable from a
clean checkout (`ratchet-gates`). What is specific to documents:

- **It writes only what it owns.** A generator for a block inside a
  hand-written file rewrites that block and nothing else; a generator for a
  whole file writes that file and nothing else.
- **It fails loudly.** A parse error, a missing source, a missing marker: the
  generator exits non-zero and writes nothing. A generator that writes a
  partial result and exits zero turns every later diff into noise.
- **It does not decide.** The generator renders what the source says. Priority
  order, wording, exceptions: they live in the source, not in the code of the
  generator.

## Markers

The whole-file header form is in `ratchet-gates`, in
`references/generated-docs.md`. The delimited block — the form for a block
inside a hand-written document — carries the same three things as the file
header: it is present, it names the source, it names the command.

```
<!-- BEGIN GENERATED: <name> — source: <path> — regenerate: <command> -->
...generated content...
<!-- END GENERATED: <name> -->
```

Rules for blocks:

- The begin and end markers are **unique** in the file. The generator fails
  when there are none (it does not create the file) or more than one.
- The generator never touches a byte outside the block. The hand-written text
  around it is not the generator's business.

## The drift gate for a document

The mechanism — regenerate into a temporary file, diff against the committed
one, exit non-zero on a difference — and the ways a gate lies while staying
green are in `ratchet-gates`, in its `references/generated-docs.md`.

What the document case adds: the diff shows exactly what the block gained or
lost. The hand-written text around it appears unchanged in both versions, so a
difference there is a generator that overstepped its block.

## Determinism

The generic rules — and the test that proves them — are in `ratchet-gates`, in
its `references/generated-docs.md`. Two things are specific to documents:

- **The order of the entries is the order of the source**, never the order the
  filesystem or a map happens to produce. A document that reshuffles on every
  run makes every diff unreadable and trains people to ignore it.
- **A quoted command or path is quoted exactly.** The reader copies it, and a
  reformatted command is a different command.

## What must not be generated

- **Rationale and storytelling** — why a decision was made, what the project is,
  what it is for, the tone. The value is the author.
- **Trade-off discussions** — they exist to be weighed, and a generated
  trade-off has no owner.
- **Instructions that embed a decision** — "do it this way because ..." is a
  decision; the command itself may be generated, the reason may not.

Two rules settle the borderline cases:

- **Prose that only points at the generated part** stays hand-written: it
  carries no number, so there is nothing to drift.
- **A sentence that repeats a generated number** is generated text: the
  generator writes it together with the number, or the number is dropped and
  the sentence points at the generated table.

The line to hold: **generate facts, write reasons**. A sentence inside the
generated block can be generated when the sentence *is* a fact ("the file is
in directory X", "the command is Y") — then the generator writes it and
nobody types it. A sentence that argues, explains or persuades has no
mechanical source.

## Mixed documents

A hand-written file with generated blocks is legitimate and common. The first
two rules that keep it safe — a marked block, a generator that recognises it,
two owners for two different statements — are in [`../SKILL.md`](../SKILL.md).

The third rule is the one people forget: the gate checks the **whole file**,
not just the block. Only the whole-file check catches a generator that
overwrites the hand-written text around the block.

The limit of that rule: a mixed file can be *internally* contradictory — the
generated table says the command is X, the hand-written paragraph still says
Y. The drift gate sees that as a diff only if the generator also owns the
paragraph that repeats the fact. Otherwise the contradiction survives the gate
and stays.

## The two-truth trap

The document-specific shape of the trap: a curated list — a table of contents,
a priority order, a set of known gaps — ends up **inside** the generated
document instead of in a source file.

The generic form of this trap — the three ways out and what each of them
costs — is in `ratchet-gates`, in its `references/generated-docs.md`. What is
specific to documents: a curated list is a source in its own right — a
**file** — and the document is derived from it (`source-of-truth.md`).

## The rule for numbers in prose

A sentence like "the project has N components, M % of them tested" is a
hand-maintained copy of a generated number, and it ages silently — prose with
no source and no gate is not diffed against anything.

Two clean ways:

- **Generate the sentence in the generated block.** The block marker covers the
  sentence; the generator writes the number from the source. The prose document
  itself stays hand-written — only the sentence moves into the block.
- **Replace the number with a reference.** Point at the generated table ("the
  inventory is in `<generated document>`"). The sentence carries no number, so
  it cannot become false.

What not to do: type the number without a marker and without a reference. It is
a claim nobody maintains, and it will be wrong exactly where the reader trusts
it.

The same applies to every number-shaped artifact in a document: a heading
("N endpoints"), a caption ("as of <date>"), a badge ("M % covered"), a table
cell. Either it is generated or it does not exist.
