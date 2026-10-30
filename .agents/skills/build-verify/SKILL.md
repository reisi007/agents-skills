---
name: Build Verify Flow
description: 'TRIGGER when a commissioned change in a git repo is about to be committed or pushed — from the START, not only on "verify": size threshold, commit message, review of the unpushed range, --amend vs. new commit, redo after CHANGES REQUIRED, TODO work, milestone review. NOT for research, questions, reading, or throwaway experiments. Flow: pull, implement, commit once, review the range, amend, push + CI.'
---

# Build Verify — pull, implement, commit, review, push

The sequence to work by. The trigger is this skill's **description** — a
user-commissioned change in a git repo. The non-negotiable minimum lives in the
`build-verify` rule file, which projects point at from their own `AGENTS.md`; it is
**not** wired into a session via a config key (the global config carries none).
Its **Rule 0** points here for everything beyond the Kleinheits-Ausnahme. The
flow starts on user **commission** and covers everything to be pushed;
research, questions, and throwaway experiments are excluded. **What counts as
green in a given repo lives in that repo's `AGENTS.md`.**

## The flow at a glance

```
0  git pull --rebase          before any real change
1  check commission (an open-work entry / scratch priority note alone is NO commission)
   → log in the repo's documented open-work list (AGENTS.todo.md or issue tracker)
2  implement — ≤5 files / ~80 diff lines: yourself; above: a builder subagent
   (trivia: all four criteria hold → no review, footer `none`)
3  commit once — Conventional, explicit paths, `Verify:` footer written after the review
4  review by a DIFFERENT subagent over the whole unpushed range
   → APPROVED | CHANGES REQUIRED
5  on CHANGES REQUIRED: fix → `git commit --amend` → re-review the range
6  push + watch CI until green — unless the user requested manual verification
+  optional, releases / every N features: milestone reviewer (cross-feature
   coherence, E2E, regression scan) — never replaces the per-change review
```

Diagram numbers are steps, `Step` headings are chapters. **The order is not
negotiable** — and every subagent dispatch in it is a fresh session (Step 2).
The `+` line is optional and sits outside that order.

## Why the review sits before the push

- **The commit is the review object, the push is the boundary.** Before the push
  `--amend` is allowed and every correction is cheap; after it, a correction is a
  new commit and a new CI run.
- **A single commit's diff cannot show a regression across rounds.** Round three
  undoing round two is green commit by commit and wrong as a series. The review
  therefore reads `git diff origin/main...HEAD`.
- **Mechanical truth belongs to the machine.** `ratchet check` and the CI prove
  that gates ran. A reviewer who re-narrates them is an expensive copy; the
  reviewer answers what neither can: does this belong here, is it complete, is
  it the smallest change.

## References — open each when the flow reaches it

- Briefing the reviewer (Step 4) → [`references/verifier-prompt.md`](references/verifier-prompt.md): contract (incl. the gates rule), plus first-run and redo templates.
- Redo commit after `CHANGES REQUIRED` (Step 5) → [`references/amend.md`](references/amend.md): amend-vs-new-commit table, the one exception (replace your own fresh pushed commit), plus reflog recovery.
- Why-questions, traps, measured evidence → [`references/notes.md`](references/notes.md).

## Step 0 — pull before any real change

```sh
git status --porcelain          # first: is the tree clean at all?
git pull --rebase               # only on a clean tree
```

**A dirty tree is never cleared away automatically.** Ask before touching it.

## Step 1 — commission, and the open-work log

An open-work entry, a scratch priority note, or a TODO line is **not** a
commission. The orchestrator reads `AGENTS.md` and the repo's documented
open-work list, logs real decisions there, and writes a temporary priority note
only where repo policy permits (IDs and order of existing tickets only, never a
second backlog, never staged, deleted when priorities settle).

## Step 2 — implement: size decides who

| Size (whole task, `git diff --shortstat`) | Who implements |
|---|---|
| up to **5 files and ~80 diff lines** | the orchestrator, inline |
| above that | a **builder subagent** with target files and a full specification |

The threshold is about **context, not competence**: a subagent leaves the
orchestrator's window free for the plan, and two independent tasks can run in
parallel. When in doubt which side of the bar, delegate. During a long goal the
bar matters more, not less — an orchestrator that fills its window with diffs
cannot reason about the next step.

**Trivia still exists** — all four `Kleinheits-Ausnahme` criteria at once: the
orchestrator makes the change, commits, pushes, and writes `Verify: none
(Kleinheits-Ausnahme, 0 rounds)`. No review run. Anything that touches
permissions, plugins, `instructions`, or hooks is never trivia.

**Fresh session per dispatch.** The builder gets a *new* session with the full
brief in the prompt, never a continued one from another task.

## Step 3 — commit once

```sh
git add <file1> <file2> …        # explicit paths, NEVER git add -A
git show --stat                    # content check before the commit
git commit -F - -- <file1> <file2> <<'MSG'
feat(pricing): add peak-window calculation for z.ai plans

Verify: pending — review of the unpushed range scheduled
MSG
```

Headline: Conventional Commits (`feat|fix|docs|refactor|test|chore|perf` +
optional scope). **One commit per task.** A number in the message that claims
something about the commit or its gates names what it measures — state and
scope. The `Verify:` footer is rewritten once the review has a verdict.

**In a tree where other sessions work the paths are not optional**:
`git commit -- <path>` takes only the named paths, a bare `git commit` takes the
whole index and with it another session's staged work; leave nothing of yours
staged. The path-commit clause binds **every** session in a shared tree, and the
responsibility is the **committer's**, not the neighbour's; no repo's branch
policy overrides it (rule file, Rule 4).

## Step 4 — review the unpushed range

A **different** subagent than the author reviews once, before the push:

```sh
git diff origin/main...HEAD        # the object of the review
git log --oneline origin/main..HEAD
```

Briefing, contract and the redo template:
[`references/verifier-prompt.md`](references/verifier-prompt.md). It checks the
substance, not the mechanical gates — those are `ratchet check` and the CI, and
they are **not re-run** on the reviewer's word.

**The reviewer is never the author of the same change** — a fresh context is the
whole point. A continued context carries the round's own assumptions into the
check and slowly turns the independent review into a co-review. Continuing a
session is admissible only for a **fix round inside the same task** that the
session itself implemented.

## Step 5 — redo after CHANGES REQUIRED

Fix, amend, re-review the **range** (not the last diff):

```sh
git commit --amend --no-edit
```

Amend only while HEAD is this task's unpushed commit with no foreign work in the
tree; otherwise a new commit. The one exception — replacing your own fresh
pushed commit with `--force-with-lease` — is conditional and documented in
[`references/amend.md`](references/amend.md).

Finally rewrite the footer with the verdict and the numbers of the reviewed
state:

```
Verify: round 1 CHANGES REQUIRED (2 findings: 1 high, 1 medium)
Verify: round 2 APPROVED over origin/main...HEAD (f64 overflow at 1M peak fixed,
  missing test added); ratchet check green — 9 of 9 gates
```

## Step 6 — push, open a PR, and watch CI

```sh
git push
gh pr create                        # where the repository requires PRs
gh pr checks --watch
gh pr merge                         # the repo's policy decides the merge
```

Except when the user explicitly requested manual verification — then do not
push, but keep watching CI if there is one. A red CI takes **priority over all
new work**.

**When CI itself is the problem** (all four are hidden skills — load by exact ID):
container-image pull fails (`unauthorized`, job dies with exit 125 before any step)
→ `ghcr-visibility` (hidden); the E2E/test image itself (what may be baked in, base-image pin,
browser version from the lockfile) → `docker-test-image` (hidden); a slow/flaky Playwright
suite, `--workers=1`, sharding → `playwright-parallel` (hidden); path filters / docs-only
commits triggering CI → `github-ci-filters` (hidden).

## Optional — milestone review (releases / every N features)

Not part of the per-change loop. **The loop above stays mandatory and unchanged;
this never replaces a per-change review run.**

- **Trigger:** a release, or every N features (N set per project, e.g. in `AGENTS.md`).
- **Scope:** coherence across the accumulated features — does the set hang together, do cross-feature paths work end-to-end (E2E), did anything regress (regression scan).
- **Dispatch:** a fresh session with a separate subagent and the full brief in the prompt — same pattern as Step 2. Findings come back as their own fix tasks, each through the full loop.
