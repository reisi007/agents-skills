# Source of truth — who owns the claim

A generated document is only as good as the answer to one question: **which
artifact owns this statement?** The generator reads that artifact; everything
else in the document is prose around it.

## Find the source by following the fact

The source of a fact is the place where the fact is **defined**, not the place
where it is **displayed**. A count shown in a README has its source wherever
the count is computed — not in the README, and not in another document that
repeats the README.

Three questions narrow it down:

1. **Who fixes it when the fact changes?** If the answer is "whoever touches
   the code", the code owns it. If it is "whoever maintains the list", the list
   owns it — and that list has to be machine-readable for a generator to read
   it.
2. **Is the fact already recorded somewhere a program can read?** A
   definition, a declaration, a registry, a manifest, a run result. If not, the
   fact currently exists only in prose — that is the problem to fix, not a
   fact to copy into another prose file.
3. **Does the source exist in a clean checkout?** A source that only exists
   after a run, a login or a manual step cannot carry a gate; it has to be
   produced by the gate itself, deterministically.

## What may serve as a source

| Candidate | May own | May not own | Check |
|---|---|---|---|
| Code (definitions, registrations, declarations) | endpoints, commands, keys, types, versions, file layout | why a thing exists, when it may be used | the generator reads the structure, not the text |
| Machine-readable file (manifest, inventory record, run result, schema) | inventories, statuses, counts, dependency lists | prose, rationale | it is parsed, not grepped; a parse error fails the generator |
| Curated list file (a roadmap, a policy list) | editorial choices: priority, exclusions, known gaps | facts the code already defines | it is the **source**, the document is derived from it |
| A hand-written document | nothing that is already recorded elsewhere | — | a document used as the source of its own content is a copy, not a source |

## Code as source

Code is the strongest source, because it is the definition. But reading it is a
mechanical problem with three traps:

- **Loose text matching produces plausible garbage.** A generator that scans
  for a pattern and prints what it finds will publish a comment, a fixture or
  a string literal as if it were the interface. Read the structure — the
  registration, the declaration, the schema — not the text around it.
- **An empty result is a valid result — and a silent one.** If the code shape
  changes and the generator finds nothing, it writes an empty table and the
  gate stays green — an empty state can hide the very change that produced it.
  The generator must fail when the *expected* entries are missing, not when the
  count is zero. The generic form of this trap, a gate that checks nothing and
  looks green, is in `ratchet-gates`, in its `references/generated-docs.md`.
- **A source that only exists after a run needs that run inside the gate.** A
  result file produced by a test run cannot be diffed against unless the gate
  reproduces the run. Otherwise the gate compares the result file with the
  copy it just made of it, and calls it a success.

## A hand-written file as source

Sometimes the honest source *is* a hand-maintained file: a priority order, a
policy, a list of known gaps. That is legitimate — as long as the file is the
**source** and the document is a **projection** of it.

The trap is the file that is both: a hand-written document that lists the facts
*and* is presented as the list. Two sources for one statement — and nothing in
the document says which one is current.

The second trap: the curated list is written where the reader looks for it —
inside the generated document instead of in the source file. Then it is a second
source of truth with extra steps (two-truth trap, `drift-and-generation.md`).

## Documentation of things that do not exist

The most damaging failure is a document that claims a feature, a command or an
endpoint which is not there. A generator protects against it **only if it reads
the code**: a file that lists features is a copy of the truth and can be as
wrong as the prose.

Three ways out, in order of preference:

1. **Derive the list from the code.** The document then cannot claim a thing
   the code does not have — not because the list was checked, but because the
   list *is* the code.
2. **Give the claim list its own gate.** Every named thing must exist and be
   reachable: the gate resolves each name against the code. That is a
   *reachability* gate, not a drift gate.
3. **Say nothing.** A feature without a name in the documentation is not
   discoverable, but it does not lie.

What does not work: reviewing the list by eye. The list is long, the review is
skipped, and the list outlives the feature.

## Decision table

| The statement | Owner | Source | Procedure |
|---|---|---|---|
| "the install command is X" | the code | the command registration | generate the line |
| "N components, M of them tested" | the test run | the result file | generate the sentence in the generated block, or point at the generated table |
| "this component is deprecated" | a person | the curated list in the source | generate from that list |
| "we chose X because Y" | a person | the decision record | hand-written, never generated |
