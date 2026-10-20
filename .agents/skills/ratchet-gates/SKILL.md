---
name: Ratchet Gates
description: 'TRIGGER when adding or repairing quality gates in a codebase that already violates them — "add a gate for this class of defect", "make this check ratchet instead of permanently red", "baseline that may only move one way", "split fast and slow checks", "generate the docs from the data", "what is not covered by our checks", "deny by default for access decisions", "one place that decides permissions". NOT for writing the feature itself, for a single bug fix, for dependency or CVE work, or for a green-field codebase without legacy violations.'
metadata:
  opencode/autoinvoke: false
---

# Ratchet Gates — boundaries a codebase can actually hold

A gate that judges the **whole population** is, in an existing codebase, either
absent or permanently red. Both are the same failure: a dead gate. Nobody keeps
a red gate, and a gate that checks nothing while looking green is worse.

The ratchet replaces the boolean with a number: *"currently N violations of
rule R"*. The gate is green while `count ≤ N` (ceiling) or `count ≥ N` (floor),
and the baseline N may only move in the declared direction. The debt is
stated instead of hidden, the direction is enforced instead of hoped for.

## Invariants

1. **A number, not a boolean.** A gate that says "violations exist" is red from
   day one. The count *is* the condition; the verdict is derived from it.
2. **The baseline is generated once, never hand-maintained.** Derived from the
   current state at introduction, then carried by the same counter. A
   hand-written baseline drifts silently — visible only when both are compared.
3. **One direction.** The baseline sinks or rises, never at will. A rising floor
   ("coverage may only grow") is a ratchet too; the direction is stated in the
   gate.
4. **A baseline change is a visible event.** It produces a diff on the
   baseline file and is therefore reviewable — never automatic.
5. **Number and report come from one source.** The gate reads the artifact the
   report reads — otherwise they contradict each other.
6. **The ratchet measures code *and* documentation.** The summary tables in the
   docs are derived artifacts and need the same treatment.
7. **There is a paydown path.** Someone must be able to move the baseline in
   its allowed direction, otherwise the number freezes. The paydown must be
   as easy as the baseline update.
8. **One gate per defect class, named in the gate header** together with the
   incident that motivated it. A gate without a named class is decoration.

## Gate design — the class the standard stack misses

The standard stack (type checker, linter, unit-test run, build) has structural,
not accidental blind spots. That is where a gate pays for itself.

| Stack part | What it cannot see |
|---|---|
| Unit-test run with mocked storage | a schema change that never creates the declared entities — the test passes against the mock |
| Tests against the dev server | the packaging and production path; a defect that only appears in the built artifact |
| Static analysis | import-time and routing errors, because it never runs the code |
| Type checker | the shape of data at runtime — a contract that is well-typed and empty |

One gate per class. The header names the class *and* the incident that proved
the class exists: without a concrete past instance the class is a hypothesis.

## Two tiers, both explicitly offered

| | Fast | Slow |
|---|---|---|
| Budget | seconds | minutes |
| Needs | no server, no database, no network | real infrastructure: database, browser, built artifact |
| Runs | at every commit, in the commit-time check | before merge or nightly |
| Answers | "can I continue?" | "can this merge?" |

Both tiers are **named, documented and locally runnable**. A tier that exists
only in the merge pipeline is a decision no developer can reproduce; a tier
that cannot be run locally makes every commit a blind flight.

The trap in the fast tier: a selection-based scope ("changed files only") in a
clean checkout selects nothing, runs **zero** checks and reports **green**. A
fast tier needs a floor — a minimum number of executed checks — or it has to
fail when the selection is empty.

The gap between the tiers is a **documented list**, not an assumption: which
classes only the slow tier covers, and which no tier covers at all.

## One source of truth, documentation generated from data

Everything derived is generated, never maintained in parallel.

- The derived file says at the top "generated — do not edit by hand" and names
  the regeneration command.
- The gate regenerates into a temporary file and **diffs** it against the
  committed one — "looks right" is not a check.
- Generators are deterministic: sorted output, no timestamps, no absolute
  paths. A generator that produces different bytes on two runs makes the gate
  flaky, and a flaky gate gets muted.
- A generated file is never edited by hand. The edit is lost at the next
  regeneration, usually silently.
- A generated file that embeds a hand-maintained list has a **second source of
  truth**. The list belongs in the source.
- Counts in prose (a README sentence, a table caption) are artifacts too and
  are generated — or replaced by a reference to the generated table.

## Fail-closed decisions

An access decision is a gate with the same shape: one decision point, not a
check at every call site. It carries no count, so it is not a ratchet — but
the decision point follows the same discipline: one place, one default —
refuse.

- The decision **refuses** when the access is missing, the permission is
  unknown, or the action is unknown — **including for the most privileged
  caller**. "Unknown" is not "allowed".
- The decisive inputs (identity, permissions, the resources in reach) never
  come from the request; they are derived from the caller's session.
- Negative tests are the pin: a forged permission, revoked access, an unknown
  action. A decision that is only tested with valid inputs is untested.

## Honest gaps

A list that names only what exists is marketing.

- The uncovered surface is named **where it lives**, with reason and blockers —
  not in a footnote of the happy path.
- A measurement table says "not measured" — never a number nobody measured.
- A skipped test is a dead test: either fix it or name it as a gap.
- The gap list gets the same discipline as the code: an owner and a ticket per
  entry, otherwise it is a graveyard.

## Core rules

1. A boolean gate over a population that already violates the rule is disabled
   on the second run, and the defect class is unguarded from then on.
2. A baseline change in the forbidden direction hides inside the diff of the
   fix it accompanies — it lands in a commit of its own.
3. A fast tier without a floor, and without an explicit empty-selection
   failure, reports green from zero executed checks: indistinguishable from
   success.
4. A tier that exists only in the merge pipeline cannot be reproduced under
   time pressure, so it gets skipped, so the branch waits.
5. The drift check is a diff, not a visual check; a generated file that
   embeds a hand-maintained list has a second source of truth.
6. A gap list without an owner is a graveyard entry.

## Checklist — introducing the first ratchet

1. Name the defect class and the incident that motivated it.
2. Write the gate header: class, incident, count unit, direction.
3. Fix the counting method: deterministic, no filesystem-order dependence.
4. Generate the baseline from the current state; let the counter carry it.
5. Give the fast tier a floor so a clean checkout cannot pass vacuously.
6. Name both tiers and make both runnable with one local command.
7. Point every derived document at one source of truth; mark generated files
   and name the regeneration command.
8. Make the drift check a diff (regenerate to a temp file, compare), not a
   visual check.
9. Provide the paydown command that moves the baseline in its allowed
   direction, as easy as the baseline update.
10. List the classes no tier covers, with owner and ticket.

## Reference files

- `references/ratchet-baselines.md` — which defect classes ratchet, count vs
  boolean, monotonicity, ceiling vs floor, the direction notation, baseline
  generation, paydown path.
- `references/check-tiers.md` — fast/slow split, the selection trap and its
  floor, the documented gap between the tiers.
- `references/generated-docs.md` — source of truth, the do-not-edit marker,
  deterministic generators, the drift gate by diff, second sources of truth,
  numbers in prose.
