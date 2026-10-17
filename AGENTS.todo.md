# AGENTS.todo.md — open work

This file is a **log, not an order**: it records decisions and open work. Logging
is mandatory; working an entry off needs an explicit order. Verified-completed
entries are removed — the history lives in the commits.

## Open

### Later wave: harmonize the `build-verify` references in 12 project `AGENTS.md` files

Logged 2026-10-17 (user decision: "später harmonisieren", executed as one subagent
per project).

**Why.** Those project files call `.agents/rules/build-verify.md` their
"always-on kernel", which reads as if the global config wired the rule into every
session. It does not: the global `instructions` array is empty (`opencode.jsonc`,
with the comment that `build-verify` was removed 2026-10-07 on user order), and
the build/verify flow reaches a session through the `build-verify` skill
description. The wording stays true *inside* a project (the project names the
file) but still suggests the missing global wiring.

**Scope.** 12 projects under `~/dev`, each with its own `AGENTS.todo.md`:
`ocgo-price-tracker`, `provider-plans`, `countdown`, `ai-10-usd`,
`optimus-image-cropper`, `angular-material-extended`, `opencode-usage`,
`portal.reisinger.pictures`, `stack-renamer.lrplugin`, `lmstudio-image-describer`,
`cc-price-tracker`, `open-accreditation`.

**How.** One subagent per project (12 total), each in its own repo, one
Conventional Commit per project, explicit paths only, and its own verify round —
the project's `AGENTS.md` decides what "green" means there.

**Grounding** (measured 2026-10-17):
`grep -rln 'build-verify' --include=AGENTS.md ~/dev` → 12 files;
`grep -rlF 'Kleinheits-Ausnahme' --include=AGENTS.md ~/dev` → 0 files, i.e. none
of them copies the rule text — all of them reference the file.
