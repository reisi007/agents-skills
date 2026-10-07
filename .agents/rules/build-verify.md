# Build/Verify flow — always on

Loaded into **every** session via the `instructions` key of the global OpenCode config. Minimum only — project commands live in that repo's `AGENTS.md`; the full loop lives in the **`build-verify`** skill.

## Scope — this flow is a commit flow

Applies when something in a git repo is about to be **committed** — feature, fix, docs, commissioned TODO work — from the first byte, and only on commission. Research, reading, answering, lookups, explaining, testing an assumption, **trying** a command or config, **viewing** a TODO: no delegating, verifying, pulling, or committing there. Pure checking leaves evidence for a later decision, not a working state, and creates no TODO entry; a kept experiment enters the flow at the decision moment — then pull first, per Rule 1.

Trying things out touches neither the permissions in `~/.config/opencode/opencode.jsonc` (secrets, foreign home directories, `.env`) nor a running colleague's tree — never `git checkout .` on someone else's work.

The loop is built for feature-scale commissioned work; a mini clearly under the bar goes direct — the test is the criteria below, not the ambition of the change.

## The rules

0. **Beyond trivia, load the skill before the first change.** Triggers: failing any `Kleinheits-Ausnahme` criterion below — size, kind (code/logic/test/build/dependency/schema), a config key whose reader changes in this task, any new self-standing behavioral rule or changed duty/threshold/exception.
1. **Pull before the first change** (`git status --porcelain`; dirty tree → ask, never autostash; else `git pull --rebase`).
2. **The orchestrator writes no code** — delegate to a subagent, except trivia below. When in doubt, delegate.
3. **Verification by a *different* subagent** than the implementer (except trivia, where the orchestrator checks itself); never destroy uncommitted work with `git checkout` / `git restore` / `git reset`.
4. **Commit after EVERY verify run, whatever the verdict** (`CHANGES REQUIRED` too). **One commit per task**, explicit paths only — never `git add -A`.
5. **Conventional Commits** with a `Verify:` footer logging the rounds; `git show --stat` before committing.
6. **Redo → `git commit --amend`** (verifier gets `nach-verify: true`); amend only while HEAD is this task's unpushed verify commit with no foreign work in the tree, else a new commit.
7. **Push and watch CI until green** — the only exception: the user explicitly requested manual verification — then **do not push, but keep watching CI if there is one**.

A repo's own documented branch policy overrides rules 4–7 where it says so — e.g. the `agent-config` skill §6 (amend + `--force-with-lease` in a single-user repo).
8. **Verification runs are sequential, never parallel.**
9. **`AGENTS.todo.md` is a log, not an order** ("Log, kein Auftrag"): logging decisions is mandatory, working entries off needs an explicit order; its **length** is not a commission — **a TODO entry triggers no verify run**, commission first, then rule 0. Verified-completed entries are removed, history lives in the commits.

## Kleinheits-Ausnahme

These four criteria stay here rather than only in the skill: "is this trivia?" must be answerable *before* deciding whether to load the skill. **All four at once** (rationale in the `build-verify` skill's `references/notes.md`).
When in doubt whether all four hold, delegate.
The test is not "is it easy" but "is it clearly under the bar".

1. **Size: up to 5 files, ~80 diff lines** (add + del, whole task, `git diff --shortstat`) — more is full loop; crossing mid-task switches to full loop from there.
2. Text only — docs, comments, formatting, config; **no** logic, control flow, API/signature change, migration. New config keys only if **no application code reads them**; an existing key with a new value counts as trivia under the same condition. Pure plumbing is text: mapping an already-existing key into env (compose `environment:`, export, `.env.example`) while the reading code is unchanged in this task. The reader test applies to the reader — a reader changed or introduced *by this task* means the full loop; a pre-existing, untouched reader keeps the mapping in trivia. Proof: `grep -rn '<key>'` in application code plus `git log -S '<key>'` — reader predates the task and is untouched → trivia. Anything touching **permissions, plugins, `instructions`, or hooks** is full loop. No proven reader → delegate.
3. No dependency/lockfile/build/test/schema change, no dependency-manager command.
4. No new rule or process decision (typo fixes excepted) — also not as pure text; no changed duty, threshold, or exception of an existing rule. K4 covers behavioural rules in `AGENTS.md` and skills; tool configuration is governed by K2 instead. Classification follows the functional change: its accompanying documentation (comments, example values, TODO-log entries, explanation of the change itself) rides along while the whole task stays under K1. K4 triggers on self-standing behavioral rules beyond the change — new duties, thresholds, or exceptions for future work.

Trivia still means: pull (1), Conventional Commit with explicit paths and `git show --stat` (4/5), push + CI (7), footer `Verify: none (Kleinheits-Ausnahme, 0 rounds)`. Omitted: implementer, verifier, `nach-verify` rounds, redo-path amend. Details in the skill.
