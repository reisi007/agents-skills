# Vocabulary — the levels, the statuses, and the rules that hold them

One language for findings, prescribed once. Every project that keeps a findings
log needs the same names for the same things: a gate that counts findings
cannot compare numbers across logs that grade them differently, and a log whose
status lives inside the severity column cannot be counted at all. The values
below are the **only** ones. A value outside these tables is a mistake to
report — never a fallback.

## Severity levels

| Level | Meaning | How to decide |
|---|---|---|
| `critical` | breaks a security boundary, loses data, or blocks the core path for everyone | would this block a release? |
| `high` | a security boundary or a core path is degraded | is a boundary weakened or a core path materially worse, but still usable? |
| `medium` | a real defect with a workaround | can the user work around it and continue? |
| `low` | a nitpick or an improvement | would a reviewer block the change over this? (no → `low`) |
| `info` | an observation, nothing to fix | is there anything to fix at all? (no → `info`); a severity that could not be recovered → `info` plus a note |

**Severity is a property of the finding; status is a property of its handling.**
The two are independent: a `critical` finding can be `open`, `in-progress`,
`accepted`, `wontfix` or `fixed`, and a `low` finding can be `fixed`. A status
change never changes the level.

## Statuses

| Status | Counts? | Visible? | Meaning |
|---|---|---|---|
| `open` | **yes** | yes | not addressed yet |
| `in-progress` | **yes** | yes | being worked on, not fixed yet |
| `fixed` | no | yes | addressed and independently verified |
| `accepted` | no | yes (as an accepted risk) | consciously accepted, with an owner decision |
| `wontfix` | no | yes (as a decision) | consciously not fixed — by design, not a defect |

The **count is the number of findings in the counting statuses** — `open` and
`in-progress`. `accepted` and `wontfix` are decisions: they do not count, but
they stay visible. **A decision is not a deletion.** `fixed` is resolved.

## Rules

- **Unknown values are an error, never a fallback.** A level or status outside
  the tables above must be reported, never silently mapped to `low` or `open`:
  a fallback turns a typo into a false statement about the state of the project.
- **A finding needs an owner and a ticket** unless it is `fixed` — the same
  rule the gap lists of this skill carry ([`../SKILL.md`](../SKILL.md), "Honest
  gaps"). A `fixed` finding has its commit and its regression test; an open one
  has nobody → a graveyard entry.
- **A finding has a stable id.** Where the source has none, one is minted once
  (`<PREFIX>-001`, …) and stays stable. An id that changes between runs makes
  every diff unreadable and every baseline meaningless.
- **Severity and status are recorded separately.** A status is never encoded in
  the severity field: `behoben 2026-10-18` in a severity cell destroys the
  severity and breaks every count that filters by level.
- **The prose document stays the human record.** A machine-readable registry is
  a *view* of the findings, not a second source of truth: prose and registry are
  migrated in the same commit and must not disagree.

## Mapping a prose log to the vocabulary

| In the log | Level | Status |
|---|---|---|
| `P1` | `critical` | n/a |
| `P2` | `high` | n/a |
| `closed` | n/a | `fixed` |
| an accepted risk (in its own file) | n/a | `accepted` |
| `behoben 2026-10-18` | see the trap below | `fixed` |
| `entschieden 2026-10-18` | see the trap below | `wontfix` |
| `widerbestehend 2026-10-18` | see the trap below | `open` — still open! |
| `—` (no defect) | n/a | **not a finding** — a coverage record |
| a row without an id | n/a | a **minted id** (`<PREFIX>-001`) |

**The trap:** when the status was written into the severity cell, the original
severity is lost — the cell no longer holds a level. The severity must be
**recovered from the row** (the finding text, the screenshot, the surrounding
table). Where it cannot be recovered, the finding is recorded as `info` **with
a note that the original severity is unknown** — an unknown level is stated,
never guessed.

An owner decision (its own identifier) is the record that backs an `accepted`
or `wontfix` entry — it is neither a severity nor a finding of its own.

## Implementation

The `ratchet` binary (`~/dev/ratchet-cli`, a separate project) is specified to
enforce this vocabulary in its findings registry — an unknown level or status
is a hard error there as well. The registry is a *view* of the prose findings:
the same rules, checked in code instead of read in prose.
