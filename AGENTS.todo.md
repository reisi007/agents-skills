# AGENTS.todo.md — open work

This file is a **log, not an order**: it records decisions and open work. Logging
is mandatory; working an entry off needs an explicit order. Verified-completed
entries are removed — the history lives in the commits.

## Open

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



