# AGENTS.todo.md — open work

This file is a **log, not an order**: it records decisions and open work. Logging
is mandatory; working an entry off needs an explicit order. Verified-completed
entries are removed — the history lives in the commits.

## Open

### The ratchet mechanic gets an executable — own repo `~/dev/ratchet-cli`

Logged 2026-10-20 (user decision: "ein kleines allgemeines CLI-Skript mit ner API …
wenn wir das in mehreren Projekten verwenden").

**Why.** The `ratchet-gates` skill describes the mechanic — baseline, direction,
monotonicity, drift diff — but nothing implements it. ~30 projects under `~/dev`
would each re-implement it, and noema already hand-rolls it
(`scripts/check-coherence.mjs` with a hand-written `BASELINE` object, which is
exactly what the skill's invariant 2 forbids: *a baseline is generated once,
never hand-maintained*).

**Decision.** The implementation lives in its **own repo** `~/dev/ratchet-cli`,
not in this one (this repo stays skills-and-docs):

- **Rust**, standalone binary `ratchet`, distributed via GitHub Releases with a
  self-update (`ratchet update`) plus a once-a-day update check.
- **ESLint-like CLI** (`--config`, `--no-config`, `--format stylish|json`,
  `--fix`, `--rule`, `--tier`, `--ignore`, `--debug`), flat-config shape
  (`ratchet.config.jsonc`; `ratchet.config.mjs` as a **data-only** JS config
  evaluated through a `node` bridge).
- The counter interface *is* the API: a rule counts via `command` (argv, no
  shell) or `file` (JSON + dotted path) — the engine owns the mechanic, the
  project owns the counting. No Node API, no plugin registry, no rule
  functions in v0.
- Normative behaviour: `~/dev/ratchet-cli/SPEC.md`.

**Open in this repo.** Add `references/cli.md` to the `ratchet-gates` skill —
the concrete commands, the config shape, the exit codes — and point the
skill's checklist at the CLI instead of describing the mechanic only.
This is documentation work in this repo; the implementation of the binary
itself lives in `~/dev/ratchet-cli` and is not tracked here.

### `ui-review/SKILL.md` still carries its own severity list (waiting for the other session)

Logged 2026-10-20 (found while introducing the canonical vocabulary).

**Why.** The canonical levels and statuses now live in
`.agents/skills/ratchet-gates/references/vocabulary.md`; `ui-review`'s
`references/findings-report.md` points at them. But `ui-review/SKILL.md`
(line ~116) still lists the report columns as
`Severity | File:Line | Screenshot | Finding | Suggested fix` (the template
gained `Id`, `Status`, `Owner` and `Ticket` columns) and lines ~119-124 still
carry a **local** severity list — the second vocabulary this change removes.

**Blocked.** `ui-review/SKILL.md` has uncommitted work from another session
(along with `references/harness.md` and the screenshot spec template). A dirty
tree is not cleared away automatically: the fix waits for that session to
commit, then it is a one-file change (columns + the local list → a pointer).

**Also open.** The class list `BELEGT/HEURISTIK/AKZEPTIERT/ZURÜCKGENOMMEN`
stays beside the canonical statuses — `AKZEPTIERT` is the canonical `accepted`.
No change needed unless the classes are to be folded into the status
vocabulary.

### The website's UI findings were graded under the retired rules

Logged 2026-10-20 (found by the verifier of the vocabulary change).

**Why.** The ui-review criteria now land in the canonical levels: "polish,
alignment, hierarchy" is `low` (canonical `low` = a nitpick or an improvement),
and an empty-state regression is `medium` **with the condition "with a
workaround"**. The website's log (`reisinger.pictures/rules/10-ui-review-findings.md`)
was written under the old grading — its legend still says "`medium` polish" —
so the legend now contradicts the file it cites.

**Open.**

- The legend (`:20-22`) must be updated to the canonical levels.
- The three open `medium` rows (`:31`, `:53`, `:83`) need one pass against the
  canonical meanings: the homepage hero row was `medium` only because "polish"
  was `medium`; the sport-hero row and the share-page H1 row are owner
  decisions and therefore `accepted` — which **does not count**.
- The row count changes with it: 16 open findings today (3 `medium` + 12 `low`
  + 1 `widerbestehend`), and the sport-hero row leaves the count once it is
  `accepted`.

This is work in the **website repo**, not here — it travels with the registry
migration the tool's backlog logs.



