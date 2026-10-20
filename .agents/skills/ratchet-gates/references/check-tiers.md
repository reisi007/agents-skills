# Check tiers — fast, slow, and the space between them

Two tiers, both explicit. A tier that nobody can name, run or reproduce is
not a tier.

## The split

| | Fast | Slow |
|---|---|---|
| Budget | seconds | minutes |
| Infrastructure | none: no server, no database, no network | real infrastructure: database, browser, built artifact |
| Runs | at every commit, in the commit-time check | before merge, or nightly |
| Question | "can I continue?" | "can this merge?" |
| Failure cost | seconds of waiting | minutes of waiting, a red merge, a broken afternoon |

Deciding which tier a check belongs to:

| Question | If yes |
|---|---|
| Does it need a server, a database, a browser or a network? | slow |
| Does it need the built artifact rather than the source tree? | slow |
| Is it deterministic and free of external state? | fast |
| Does it take more than a few seconds? | slow (a fast tier that takes minutes is not run at every commit) |
| Does it catch a defect class that only the slow tier covers? | it must exist at least once — but see the gap list below |

A check that only exists in the slow tier is acceptable. A check that exists
nowhere is a gap and belongs in the gap list, not in an assumption.

## Both tiers are named, documented and locally runnable

**Named** — a stable identifier (`fast` / `slow`, or a per-check name under a
tier prefix), used identically in the local runner, in the commit-time check
and in the merge gate. A tier identified by three different names in three
places cannot be reasoned about.

**Documented** — for each tier: what it covers, what it explicitly does not,
what it needs (time, infrastructure, credentials), and where it runs. A tier
that exists only in the merge pipeline is a decision no developer can
reproduce or debug.

**Locally runnable** — one command, no special environment, no credentials
the developer does not have. The local slow tier runs under the same
environment definition as the merge gate (same definitions, same versions from
the lockfile); a slow tier that runs locally with different versions than the
merge gate is a different check wearing the same name.

A tier that cannot be run locally turns every commit into a blind flight: the
developer finds out at merge time, which is the most expensive moment to find
out.

## The traps

**1. The slow tier exists only in the merge pipeline.** Nobody can reproduce
its red state locally, so it is unfixable under time pressure, so it gets
skipped, so the branch waits for the next attempt.

**2. The fast tier is a subset that can pass vacuously.** The classic case: a
selection-based scope — "changed files only". In a clean checkout nothing
changed, the selection is empty, **zero** checks run, and the gate reports
green. The signal is indistinguishable from "everything is fine". A reviewer
reading the green gate has learned nothing.

The countermeasures, both needed:

- a **floor**: a minimum number of executed checks; below it the tier fails
  instead of passing.
- an **explicit empty-selection failure**: "selection matched 0 files" is an
  error, not a pass. A tier that skips silently teaches the team to ignore it.

The floor is itself a ratchet: the number of executed checks must not fall
below the recorded value, so a fast tier cannot be quietly narrowed.

**3. The tier's scope drifts.** A check moves from slow to fast, or a filter
is added, without anyone updating the tier definition. The scope is defined in
one place; both tiers and the documentation read that one place.

**4. The names do not carry the cost.** `check` and `check-full` say nothing
about budget. The tier name or its description carries it: seconds vs minutes,
no infrastructure vs infrastructure.

## The gap between the tiers is a documented list

The tiers do not cover everything, and the difference is not a guess. The repo
holds an explicit list of the classes that only the slow tier covers, and of
the classes that **no** tier covers.

- The list lives where the checks live, next to the tier definitions — not in
  a slide, not in a chat message.
- Each entry names the class, why it is not covered (effort, missing
  infrastructure, a decision), and an **owner plus a ticket**. An unowned
  gap is a graveyard entry.
- The list is regenerated where the check inventory can be derived — otherwise
  it goes stale and starts claiming coverage that no longer exists.
- A class that moves from "uncovered" to "covered" disappears from the list
  in the same commit that adds the check. A gap list that only grows is a
  backlog nobody works through.

The list is the honest counterpart of the gates: the gates say what is
enforced, the gap list says what is not. Both are needed; a gate set without
a gap list reads as full coverage.
