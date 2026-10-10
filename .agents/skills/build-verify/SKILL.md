---
name: Build Verify Flow
description: 'TRIGGER when a user-commissioned change in a git repo is about to be committed or pushed — at the START of any such task, not only when the user says "verify". NOT for research, questions, reading, or throwaway experiments. This is the flow the always-on rule (the `build-verify` rule file, Rule 0) points to for everything beyond the Kleinheits-Ausnahme. Covers: pull before changing, the Kleinheits-Check, delegation to an implementer subagent, the verify run with an independent verifier and its `nach-verify` flag, commit after EVERY verify round regardless of the verdict, Conventional Commits with a verify-round footer, amend on redo, one commit per task, push plus CI watch. Also TRIGGER when deciding whether a change is small enough to skip the loop, when a commit message should be written, when deciding between `git commit --amend` and a new commit, when a verifier must be told whether it is a redo, when a verdict was CHANGES REQUIRED, or when a repo''s AGENTS.md duplicates this flow.'
---

# Build Verify — pull, delegate, verify, commit, amend, push

The sequence to work by. The non-negotiable minimum is the always-on
`build-verify` rule file, wired via the `instructions`
key of the global config — so it is in context in **every** session, and its
**Rule 0** points here for everything beyond the Kleinheits-Ausnahme. The flow
starts on user **commission** and covers everything to be committed; research,
questions, and throwaway experiments are excluded. **What counts as green in a
given repo lives in that repo's `AGENTS.md`.**

## The flow at a glance

```
0  git pull --rebase          before any real change
1  check commission (a TODO entry alone is NO commission) → log in AGENTS.todo.md
2  Kleinheit check → a) delegate (default)  b) OR do it yourself if all 4 criteria hold
3  verify run by a separate subagent → APPROVED | CHANGES REQUIRED   (omitted for b)
4  commit — ALWAYS, whatever the verdict says        one commit per task
5  on CHANGES REQUIRED: fix → verify run with nach-verify: true → git commit --amend
6  push + watch CI until green — unless the user requested manual verification
```

Diagram numbers are steps, `Step` headings are chapters: 0 = pull, 1+2 =
commission/delegation, 3 = verify, 4 = commit, 5 = redo, 6 = push. **The order is
not negotiable** — and every subagent dispatch in it is a fresh session (Step 1).

## References — open each when the flow reaches it

- Briefing the verifier (Step 2) → [`references/verifier-prompt.md`](references/verifier-prompt.md): contract plus first-run and redo templates.
- Redo commit after `CHANGES REQUIRED` (Step 3/5) → [`references/amend.md`](references/amend.md): amend-vs-new-commit table plus reflog recovery.
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
| **Orchestrator** | main agent | **read** `AGENTS.md` / `AGENTS.todo.md`; always log real decisions, otherwise write only under the Kleinheits-Ausnahme. Delegate, have verified, commit |
| **Implementer** | subagent | write code/tests, target files + full specification |
| **Verifier** | **different** subagent | check, measure, report findings — **not** fix |

**Kleinheit check:** if all four criteria from the always-on rule's
`Kleinheits-Ausnahme` section hold, the orchestrator makes the change itself —
Conventional Commit, push + CI, footer `Verify: none (Kleinheits-Ausnahme, 0
rounds)`, self-checked with the repo `AGENTS.md`'s sub-minute commands.
Otherwise: delegate, with target files and a full specification. No
`AGENTS.todo.md` entry except for a real decision. Config with no repo (e.g.
`~/.config/opencode/opencode.jsonc`): no pull/commit/CI — reload via `touch`,
check in a fresh session.

**The verifier is never the implementer of the same task** — its fresh context is
the whole point (contract in
[`references/verifier-prompt.md`](references/verifier-prompt.md)).

**Fresh session per round — implementer and verifier alike.** Every dispatch is a
*new* subagent session with the full brief inside the prompt; a session is never
continued across rounds or tasks. A continued context carries the code's own
assumptions and the round's own defects into the next round, grows with every
round, and slowly turns the "independent" check into a co-check. Continuing a
session is only admissible for a **fix round inside the same task** that the
session itself just implemented — and even then the orchestrator decides
consciously.

## Step 2 — the verify run

A separate subagent verifies. First run passes `nach-verify: false`, a redo run
`nach-verify: true` — see
[`references/verifier-prompt.md`](references/verifier-prompt.md) for the briefing.

## Step 3 — commit after every verify run, whatever the verdict says

```sh
git add <file1> <file2> …        # explicit paths, NEVER git add -A
git show --stat                    # content check before the commit
git commit -F - <<'MSG'
feat(pricing): add peak-window calculation for z.ai plans

Verify: round 1 CHANGES REQUIRED (2 findings: 1 high, 1 medium)
Verify: round 2 APPROVED (fixed: f64 overflow at 1M peak, missing test)
MSG
```

Headline: Conventional Commits (`feat|fix|docs|refactor|test|chore|perf` +
optional scope); the `Verify:` footer logs the rounds. **One commit per task.**
On `CHANGES REQUIRED`: fix, re-verify, then commit per
[`references/amend.md`](references/amend.md).

## Step 4 — push and watch CI

```sh
git push
gh run list -L 3                    # which runs started
gh run watch <run-id> --exit-status # until green or red
```

Except when the user explicitly requested manual verification — then do not push, but keep watching CI if there is one. A red CI takes
**priority over all new work**.
