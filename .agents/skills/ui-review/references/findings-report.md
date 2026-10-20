# UI Review — Findings Report

Consolidate all findings here. One row per finding; group by
screenshot batch (filled → empty, desktop → mobile). A verdict is only
APPROVED when no `critical` or `high` findings remain unresolved (`open` or
`in-progress`).

## Template

```markdown
# UI Review Findings — <app> — <date>

Capture: `pnpm test:screenshots` · output: `test-results/ui-screenshots/`
Verdict: `APPROVED` | `CHANGES REQUIRED`

## Filled · Desktop

| Id | Severity | Status | Owner | Ticket | File:Line | Screenshot | Finding | Suggested fix |
|----|----------|--------|-------|--------|-----------|------------|---------|---------------|
|    |          |        |       |        |           |            |         |               |

## Filled · Mobile
...

## Empty · Desktop
...

## Empty · Mobile
...

## Open follow-ups
- ...
```

## Severity definitions

The levels and their **meanings are canonical** — the `ratchet-gates` skill,
`references/vocabulary.md`. What this file adds is a **decision aid**: the
render criteria that land in which level. When a criterion fits two levels,
the canonical meaning decides.

| Severity | Render criteria that land here |
|---|---|
| `critical` | Blank/broken page, content overlap or cut-off, hard functional blocker visible in the render. |
| `high` | Visible layout/contrast/hierarchy defect, inconsistent spacing that degrades usability. |
| `medium` | A defect with a workaround — an empty-state regression while the content stays reachable another way. |
| `low` | Polish issue, minor alignment, suboptimal hierarchy, nitpick, stylistic preference. |
| `info` | An observation that names no defect — e.g. a deliberate design choice worth recording. |

## Status

The status is a **field of its own** — the canonical statuses are in the
`ratchet-gates` skill, `references/vocabulary.md`. It never goes into the
severity cell: `behoben 2026-10-18` in a severity column destroys the severity
and breaks every count that filters by level. A `—` row is a **coverage
record** — this surface was checked and shows no defect — not a finding: no id,
no owner, no ticket.

## Rules

- Every finding that is not `fixed` carries an **id**, an **owner** and a
  **ticket** — the canonical rule (`ratchet-gates`, `references/vocabulary.md`).
  A coverage row carries none.
- **`critical`/`high` block the verdict `APPROVED`** → verdict is `CHANGES REQUIRED`.
- Every finding must carry a `File:Line` for the fix (source file + line, not the
  screenshot) and the exact screenshot file name that exposed it.
- `File:Line` must point into the source (`File:Line` of the component/view), not
  into generated screenshots.
- Duplicate findings across states are one finding with both screenshots listed.
- Re-verify after fixes: re-capture the affected routes and diff old vs new.
