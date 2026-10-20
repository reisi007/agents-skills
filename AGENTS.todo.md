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

