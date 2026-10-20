# Ratchet baselines — counting, direction, monotonicity

The baseline is the number that makes a gate usable in an existing codebase.
This file covers which defect classes can carry one, how the number is
introduced and kept, and what "may only move in one direction" means
concretely.

## Which defect classes ratchet

A class ratchets when three things hold: the violations can be **counted** in a
stable unit, count zero is **not reachable today**, and the count is **identical**
on two runs over the same tree. If any of the three fails, the gate is either a
boolean gate (count is already zero) or noise (the count flickers).

| Class | What is counted | Count unit |
|---|---|---|
| Layer violation | occurrences of a forbidden dependency direction | occurrences |
| Missing translation | declared strings without a translation | strings |
| Untested module | modules without a test that exercises them | modules |
| Schema drift | declared entities that no migration creates | entities |
| Stale artifact | committed derived files whose regenerated content differs | files |
| Unfinished marker | placeholders, stubs, disabled checks | occurrences |
| Undocumented surface | public entry points missing from the docs | entry points |
| Dead export | exports no reachable caller uses | exports |
| Oversized unit | files or functions above a size threshold | files |

Excluded: classes whose count is already zero (write a boolean gate), classes
whose count depends on the environment (the number differs between two
environments — the gate is flaky), and classes without a stable unit (a count
of "problems" that means something different each time it is produced).

## Count vs Boolean

| | Boolean gate | Count gate (ratchet) |
|---|---|---|
| Condition | no violation exists | `count ≤ baseline` (ceiling) or `count ≥ baseline` (floor) |
| On the existing codebase | red from day one | green, with a stated debt |
| Fate | disabled, then deleted | stays, and the debt shrinks |
| What it measures | perfection | progress |

The count is the condition; the verdict is derived from it. A report that
prints "violations: 12" while the gate compares a different number is two
sources of truth — see invariant 5 in [`../SKILL.md`](../SKILL.md).

## Monotonicity

Monotonicity is a property of the **baseline file**, not of the code: the
committed baseline may only move in the declared direction. The gate enforces
two things at once:

1. `count ≤ baseline` (ceiling) or `count ≥ baseline` (floor) — the code does
   not get worse.
2. the baseline file itself only changes in the allowed direction — a change
   in the forbidden direction is rejected by the same gate that checks the
   count.

The second check needs a reference value: it compares the baseline in the
working tree against the **committed** baseline of the previous revision, not
against itself. A gate that reads only the working copy cannot see a forbidden
move at all — the change is already in the file it reads.

A baseline change in the forbidden direction is therefore its own visible
event: a diff on one file, with a reason, in a commit of its own. Bundled with
the fix, it would hide inside that diff. A change in the allowed direction is
the opposite: it belongs **with** the fix in the same commit, so every commit
in the series is green.

**Determinism is part of the contract.** The count must be identical on two
runs over the same tree: sort the output, iterate deterministically, exclude
nothing that depends on the environment, never let a timestamp into the
number. A count that flickers by one makes the gate red at random, and a gate
that cries wolf is muted.

## Ceiling vs Floor

| | Ceiling ratchet | Floor ratchet |
|---|---|---|
| Condition | `count ≤ baseline` | `count ≥ baseline` |
| Baseline moves | down only | up only |
| Typical class | debt: violations, missing translations, oversized files | coverage: translated share, tested share, documented share |
| Paydown | fix N occurrences, lower N | cover N more entities, raise N |
| Failure mode | baseline freezes because nobody lowers it | baseline drifts up because raising is easy, and the code never catches up |

Both are ratchets. The difference is the direction, and the direction belongs
in the gate header. A coverage floor ("at least 34 modules have a test") is a
floor ratchet — the baseline only grows, and a drop below it is a regression.

Note the asymmetry: the allowed direction of a floor — raising it — is easy to
do by accident, the allowed direction of a ceiling — lowering it — is easy to
forget. Both need the same discipline: the paydown must be as regular as the
baseline update, or the gate stops ratcheting.

## Direction notation

The gate header carries everything needed to interpret the number:

```
rule:            no-direct-storage-imports
class:           layer violation (incident: a schema change bypassed the
                 repository layer and was never applied to a real database)
unit:            occurrences
direction:       ceiling (baseline may only decrease)
baseline:        12
count now:       12
```

```
rule:            module-test-coverage
class:           untested module (incident: a module shipped without any test
                 touching it)
unit:            modules
direction:       floor (baseline may only increase)
baseline:        34
count now:       36
```

The unit is not optional: a baseline of "12" means nothing without "12
occurrences" and "12 modules". The incident belongs in the header because it
is the answer to "why does this gate exist" — without it the class cannot be
re-checked against reality later.

## Introducing a baseline

1. Run the counter over the current tree → the number M.
2. Write `baseline: M` into the baseline file, next to the rule, the unit and
   the direction.
3. The gate now compares the count against M — green, with the debt stated.
4. From here the counter **carries the baseline**: the same run that produces
   the count also knows the baseline, and a count that crosses the baseline in
   the forbidden direction is a hard error, not a warning. A count on the
   allowed side of the baseline is the healthy state, not an error.

The baseline file holds one record per rule. It is machine-written (the
counter writes it), never hand-edited — hand-edited baselines drift silently:
the file says 12 while the code has 15, and nobody notices until both numbers
are compared in one place.

A baseline update is a **separate, deliberate command** that writes the
current count into the baseline file. It is never a side effect of running the
counter, and never part of the normal commit flow: a baseline that follows the
count on its own moves in the forbidden direction, and the ratchet stops
ratcheting.

## Paydown path

Every gate ships with a command that moves the baseline in its **allowed**
direction: a ceiling is lowered, a floor is raised. Its properties:

- **One command**, with the same shape as the baseline update command.
- It touches **only** the baseline file.
- After it runs, the gate is green — the fix and the baseline change belong
  in the same commit, so the tree is green at every commit in the series.
- It is **not** part of the automatic flow. An automatic baseline change is a
  change without a decision: the diff stays visible, but nobody chose it. In
  both directions the automatic variant moves the baseline the wrong way — a
  ceiling raises itself to the current count, a floor lowers itself to it.

If the paydown takes more work than the baseline update, the baseline freezes
and the gate becomes theatre. The metric to watch: how long since the baseline
last moved in its allowed direction. A baseline that has not moved in months is
a debt register with extra steps — either pay down or close the gate and name
the debt as a gap.
