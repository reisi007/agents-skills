---
name: Build Verify Flow
description: 'TRIGGER when a user-commissioned change in a git repo is about to be committed or pushed — from the START of any such task, not only on "verify" — including the Kleinheits-Check, commit message, --amend vs. a new commit, a redo after CHANGES REQUIRED, commissioned TODO work, a repo AGENTS.md duplicating this flow, and a milestone review. NOT for research, questions, reading, or throwaway experiments. Flow: pull, delegate, verify independently, commit after every round, push + CI.'
---

# Build Verify — pull, delegate, verify, commit, amend, push

The sequence to work by. The trigger is this skill's **description** — a
user-commissioned change in a git repo. The non-negotiable minimum lives in the
`build-verify` rule file, which projects point at from their own `AGENTS.md`; it is
**not** wired into a session via a config key (the global config carries none).
Its **Rule 0** points here for everything beyond the Kleinheits-Ausnahme. The
flow starts on user **commission** and covers everything to be committed;
research, questions, and throwaway experiments are excluded. **What counts as
green in a given repo lives in that repo's `AGENTS.md`.**

## The flow at a glance

```
0  git pull --rebase          before any real change
1  check commission (an open-work entry alone is NO commission) → log in the open-work list (issues or AGENTS.todo.md)
2  Kleinheit check → a) delegate (default)  b) OR do it yourself if all 4 criteria hold
3  verify run by a separate subagent → APPROVED | CHANGES REQUIRED   (omitted for b)
4  commit — ALWAYS, whatever the verdict says        one commit per task
5  on CHANGES REQUIRED: fix → verify run with nach-verify: true → git commit --amend
6  push + watch CI until green — unless the user requested manual verification
+  optional, releases / every N features: milestone reviewer (cross-feature
   coherence, E2E, regression scan) — never replaces per-feature verify
```

Diagram numbers are steps, `Step` headings are chapters: 0 = pull, 1+2 =
commission/delegation, 3 = verify, 4 = commit, 5 = redo, 6 = push. **The order is
not negotiable** — and every subagent dispatch in it is a fresh session (Step 1).
The `+` line is optional and sits outside that order.

## References — open each when the flow reaches it

- Briefing the verifier (Step 2) → [`references/verifier-prompt.md`](references/verifier-prompt.md): contract (incl. the gates rule), plus first-run and redo templates.
- Redo commit after `CHANGES REQUIRED` (Step 3/5) → [`references/amend.md`](references/amend.md): amend-vs-new-commit table, the one exception (replace your own fresh pushed commit), plus reflog recovery.
- Why-questions, traps, measured evidence → [`references/notes.md`](references/notes.md).

## Step 0 — pull before any real change

```sh
git status --porcelain          # first: is the tree clean at all?
git pull --rebase               # only on a clean tree
```

**A dirty tree is never cleared away automatically.** Ask before touching it.

## Step 1 — delegate, unless it is trivia

| Role | Who | May |
|---|---|---|
| **Orchestrator** | main agent | **read** `AGENTS.md` / the open-work list; always log real decisions, otherwise write only under the Kleinheits-Ausnahme. Delegate, have verified, commit |
| **Implementer** | subagent | write code/tests, target files + full specification |
| **Verifier** | **different** subagent | check the substance (diff vs. commission, invariants, blast radius); do **not** re-run green gates (four exceptions in the reference); report findings, **not** fix |
| **Milestone reviewer** | separate subagent (**optional**) | cross-feature coherence, E2E, regression scan at releases / every N features; **not per feature** |

**Kleinheit check:** if all four criteria from the rule file's
`Kleinheits-Ausnahme` section hold, the orchestrator makes the change itself —
Conventional Commit, push + CI, footer `Verify: none (Kleinheits-Ausnahme, 0
rounds)`, self-checked with the repo `AGENTS.md`'s sub-minute commands.
Otherwise: delegate, with target files and a full specification. No
open-work-list entry except for a real decision. Config with no repo (e.g.
`~/.config/opencode/opencode.jsonc`): no pull/commit/CI — reload via `touch`,
check in a fresh session.

**The verifier is never the implementer of the same task** — fresh context is the
whole point (contract in
[`references/verifier-prompt.md`](references/verifier-prompt.md)).

**Fresh session per round — implementer and verifier alike.** Every dispatch is a
*new* subagent session with the full brief inside the prompt; a session is never
continued across rounds or tasks. A continued context carries the round's own
defects into the next round, grows with every round, and slowly turns the
"independent" check into a co-check. Continuing a session is only admissible for
a **fix round inside the same task** that the session itself just implemented —
and even then the orchestrator decides consciously.

## Step 2 — the verify run

A separate subagent verifies. First run passes `nach-verify: false`, a redo run
`nach-verify: true` — briefing and contract:
[`references/verifier-prompt.md`](references/verifier-prompt.md).

## Step 3 — commit after every verify run, whatever the verdict says

```sh
git add <file1> <file2> …        # explicit paths, NEVER git add -A
git show --stat                    # content check before the commit
git commit -F - -- <file1> <file2> <<'MSG'
feat(pricing): add peak-window calculation for z.ai plans

Verify: round 1 CHANGES REQUIRED (2 findings: 1 high, 1 medium)
Verify: round 2 APPROVED (fixed: f64 overflow at 1M peak, missing test)
MSG
```

Headline: Conventional Commits (`feat|fix|docs|refactor|test|chore|perf` +
optional scope); the `Verify:` footer logs the rounds. **One commit per task.**
A number in the message that claims something about the commit or its gates names what it measures — state and scope.
On `CHANGES REQUIRED`: fix, re-verify, then commit per
[`references/amend.md`](references/amend.md).

**In a tree where other sessions work the paths are not optional**:
`git commit -- <path>` takes only the named paths, a bare `git commit` takes the
whole index and with it another session's staged work; leave nothing of yours
staged. The path-commit clause of rule 4 binds **every** session in a shared tree, and the responsibility is the **committer's**, not the neighbour's; no repo's branch policy overrides it (rule file, Rule 4 — the measured case in
[`references/notes.md`](references/notes.md)).

## Step 4 — push, open a PR, and watch CI

```sh
git push
gh pr create                        # where the repository requires PRs
gh pr checks --watch
gh pr merge                         # the repo's policy decides the merge
```

Except when the user explicitly requested manual verification — then do not push, but keep watching CI if there is one. A red CI takes
**priority over all new work**.

**When CI itself is the problem** (all four of these are hidden skills — load by exact ID):
container-image pull fails (`unauthorized`, job dies with exit 125 before any step)
→ `ghcr-visibility` (hidden); the E2E/test image itself (what may be baked in, base-image pin,
browser version from the lockfile) → `docker-test-image` (hidden); a slow/flaky Playwright
suite, `--workers=1`, sharding → `playwright-parallel` (hidden); path filters / docs-only
commits triggering CI → `github-ci-filters` (hidden).

## Optional — milestone review (releases / every N features)

Not part of the per-feature loop. **The loop above stays mandatory and unchanged;
this never replaces a per-feature verify run.**

- **Trigger:** a release, or every N features (N set per project, e.g. in `AGENTS.md`).
- **Scope:** coherence across the accumulated features — does the set hang together, do cross-feature paths work end-to-end (E2E), did anything regress (regression scan).
- **Dispatch:** a fresh session with a separate subagent and the full brief in the prompt — same pattern as Step 1. Findings come back as their own fix tasks, each through the full loop.
