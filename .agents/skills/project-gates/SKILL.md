---
name: Project Gates
description: 'TRIGGER when scaffolding a project, or when bringing an existing repository onto the canonical agent-rule gates (ratchet preset, baseline, pre-commit hook, CI step). Run once per repository; idempotent.'
metadata:
  opencode/autoinvoke: false
---

# Project Gates — the canonical agent rules, in every repository

Six rules, one config line. They cover the defect classes no project happened
to guard: a rule file nobody can load, a rule file that grew into a
specification, a plan without a state, a gate disarmed by the change it
should catch, a commit with no evidence, a project with no rules at all.

The rules ship **inside `ratchet`** as the preset `agent-rules`. There is no
script to copy and no fragment to keep in sync: the counter runs in the
binary, and the rule set is whatever version the project pins.

## What a project ends up with

| Path | Role |
|---|---|
| `ratchet.config.jsonc` | one object: `{ "preset": "agent-rules" }` (+ the project's own rules) |
| `ratchet.baseline.json` | the count at introduction; moves one way only |
| `.githooks/pre-commit` | `ratchet check --tier fast` before every commit |
| `.github/workflows/*.yml` | the same check in CI, pinned to a ratchet version |

## Runbook

Run from the repository root. Every step is idempotent.

1. **Add the preset.** Append `{ "preset": "agent-rules" }` to
   `ratchet.config.jsonc`; if the config is a single object, wrap it in an
   array first. The preset merges **before** the object's own fields, so a
   project rule with the same id overrides it — keep the preset element after
   its own rules only if the project should win, otherwise first.
2. **Count, then baseline.** `ratchet count` — read the numbers before you
   accept them. Then `ratchet baseline init`. The baseline is the truth at
   introduction, never a hand-written number.
3. **Do not lower a baseline** to make a gate green. A red gate at
   introduction means the repository violates the rule; that is what the
   baseline records.
4. **Hook.** Append to `.githooks/pre-commit` (never replace an existing
   CodeGraph hook):

   ```sh
   # Agent-rule gates — the preset from ratchet.
   if command -v ratchet >/dev/null 2>&1; then
     ratchet check --tier fast -q || exit 1
   fi
   ```

   Then `git config core.hooksPath .githooks`. The hook path is **local** Git
   config — the repository cannot switch it on for anyone else, so this is a
   bootstrap step as much as a gate.
5. **CI.** `uses: all-the-rest/ratchet-cli@v1` with `mode: validate`,
   `tier: fast`, and `version:` pinned to the release the project was
   migrated on. Mark the job a required check.
6. **Rules in `AGENTS.md`.** Two sentences, both canonical:

   > Regeln dieser Ebene. Was nur ein Verzeichnis betrifft, gehört in die
   > `AGENTS.md` **dieses** Verzeichnisses — sie wird geladen, wenn eine Datei
   > daraus gelesen wird.
   >
   > Ein Plan in `docs/plans/` beginnt mit `**Status:** Plan | In Arbeit | Done |
   > Empfehlung, nicht implementiert`.

7. **Commit.** One commit, `Verify:` footer with the counts:

   ```
   feat(gates): adopt the canonical agent rules

   Verify: ratchet check green — rule-file-name 0, rule-file-present 1,
   rule-file-max-lines 150 ≤ 150, plan-status-line 0, gates-untouched 0,
   unverified-commits 0.
   ```

## The six rules

| Rule | Direction | Meaning |
|---|---|---|
| `rule-file-name` | ceiling 0 | no `Agents.md`, only `AGENTS.md` |
| `rule-file-present` | floor 1 | the root rule file exists |
| `rule-file-max-lines` | ceiling | the longest `AGENTS.md`, `aggregate: max` — modularise to pay down |
| `plan-status-line` | ceiling 0 | every plan carries a state |
| `gates-untouched` | ceiling 0 | no commit changes a gate and product code together |
| `unverified-commits` | ceiling 0 | no commit without a `Verify:` footer |

## The traps

- **A red gate at introduction is not a bug in the rule.** `rule-file-max-lines`
  on a 623-line file is the rule working. The baseline records the debt; the
  paydown is a module-local `AGENTS.md`.
- **`unverified-commits` counts the whole history without `since`.** That is
  intended: the number only grows, so every new commit without a footer is
  caught, and the baseline never has to be raised. Narrow the window with
  `"since": "YYYY-MM-DD"` once the project tags releases.
- **`gates-untouched` counts what is not yet on `origin/main`.** On a clean
  `main` checkout it is 0 by design; it guards the unpushed range.
- **The tier floor must cover the rules.** If the project sets
  `tiers.fast.floor`, it must be at least the number of rules that run there,
  or the tier can go green having run nothing.
- **The preset is a version, not a file.** `ratchet` has no `extends` across
  repositories. Updating the rules means updating the binary — pin it in CI
  and in the hook, or the meaning of the baseline changes silently.

## Where the rules came from

`anomalyco` runs a deterministic agent policy from the base branch
(`hex/.github/workflows/agent-policy.yml`) and documents plans as state
(`**Status:** …`). Those two ideas are theirs. The ratchet shape — a number
that may only move one way, with the debt visible in the diff — is ours, and
it is the reason the rules are baselines instead of assertions.
