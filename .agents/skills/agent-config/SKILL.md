---
name: Agent Config
description: TRIGGER when setting up a new machine/agent, wiring the global OpenCode configuration (opencode.jsonc, MCP servers, skills array), registering the central skills repo (agents-skills), or answering "how is my agent configured" / "where do my skills live" / "how do I add an MCP server". Reference for the single source of truth of this developer's agent tooling.
---

# Agent Config — global setup, single source of truth

Everything about this developer's agent tooling: where config lives, how the
skills repo is registered, how MCP servers are wired, and how to bring a new
machine/project online.

> **Size note:** this file keeps decisions and wiring rules; verbatim config
> lives in `references/snippets.md`. Still over the ~150-line target — the
> overflow is the §2a/§8 wiring detail, which loses its force if shortened
> further.

## 1. Global config files

| File | Purpose |
|---|---|
| `~/.config/opencode/opencode.jsonc` | Global OpenCode config: permissions, agents, MCP servers, `skills` array |
| `~/.config/opencode/AGENTS.md` | Global agent instructions (CodeGraph usage block, …) |
| `~/dev/agents-skills/` | **Central skills repo** (GitHub `reisi007/agents-skills`) — the only home of own skills |
| `~/.agents/skills/` | Cross-agent compat source for third-party/official skills (daisyui, find-skills, blog-beitrag, testimonial symlinks) — NOT for own skills |

## 2. Skills repo registration (the `skills` array)

Own skills live in **one** git repo, not per project — the `skills` array
points at its `.agents/skills` directory (verbatim: `references/snippets.md`
§1). The structure follows the portable Agent Skills spec, so other agents
can consume the same dir.
- OpenCode also **auto-discovers** project-local `.agents/skills`,
  `.opencode/skills`, `.claude/skills` (compat) — but the convention here is:
  **no own skills inside projects**; everything own lives in agents-skills.
- Adding a new own skill: create `<agents-skills>/.agents/skills/<id>/SKILL.md`
  (frontmatter `name` + `description`, kebab-case ID = directory name), commit,
  push. No config change needed — the dir is already registered.
- Same ID in two sources: later source wins, so the repo entry wins over any
  leftover project copy (low → high: builtin → compat → global → project →
  `skills` array).

## 2a. Always-on rules (the `instructions` array) — NOT the same as a skill

A skill is **trigger-based**: its `description` has to match before its body is
read. That is the right mechanism for detail that is only needed sometimes, and
the wrong one for a rule that must hold in *every* session (the build/verify
flow: pull first, never implement in the orchestrator, always verify with a
second subagent, commit after every verify round). A rule that lives only in a
skill is a rule that gets skipped exactly when it is inconvenient.

For those, the config has a second key — `instructions`, "Additional instruction
files or patterns to include". **One entry per rule file**, and several entries are
the normal case, not the exception: currently `build-verify.md` and `ask.md`
(verbatim: `references/snippets.md` §2).

> **Note (installed opencode v2.0.22 — verified, not assumed):** the
> `instructions` key parses but does not deliver the file into the system
> prompt — a listed rule file demonstrably never reaches it, while `AGENTS.md`
> files do. Interim path: the always-on rules are inlined into the global
> `~/.config/opencode/AGENTS.md` (with provenance line). Keep the
> `instructions` entries in place so they work when the feature does.

- **`build-verify.md` and `ask.md` are the two registered rules.** A rule file without
  an entry **silently contributes nothing** — an unregistered, misspelled or wrong path
  looks exactly like a working setup until it is tested.

- **Path forms** (resolution, not delivery on v2.0.22): absolute and `~/`
  paths; relative paths and globs resolve against the project (an absolute
  glob works too — it is globbed with `cwd = dirname`). Remote `https://`
  URLs are fetched with a 5 s timeout.
- Intended delivery (not the path on v2.0.22 — see note above): the file's
  content is injected as `Instructions from: <path>` into the system prompt,
  alongside every `AGENTS.md` — **not** read on demand, so it costs context in
  every session. Keep it short: one screen, no examples, no history.
- That is the split: `.agents/rules/` = always in context, short and absolute;
  `.agents/skills/` = on demand, with the reasoning, tables and evidence. The
  rule file points at the skill; it does not duplicate it.
- Adding another always-on rule (e.g. a third one after `ask.md`): new file in
  `.agents/rules/` + one more entry in the array. Nothing else to wire — and
  the new file stays invisible until that entry is there.
- **Reloading:** like any config change, the running `opencode2` service caches
  resolved config — `touch ~/.config/opencode/opencode.jsonc` or restart the
  session (see §3 for the same gotcha on MCP). Once the feature works, verify
  the wiring **once** after setup: in a fresh session, ask the agent to repeat
  the rule file's first heading without reading the file — if it can, the entry
  resolved. On v2.0.22 verify the inlined copy in the global `AGENTS.md` the
  same way instead. A path that does not exist **silently contributes nothing**,
  so a wrong path looks exactly like a working setup until you test it.
- **Do not put an always-on rule into the global `AGENTS.md` just because it is
  easier** — that file is not in this repo and not versioned with it. The
  `instructions` path keeps the rule in `agents-skills`, versioned and
  reviewable, which is the whole point of the repo. Interim exception on
  v2.0.22: the inlined copies there ARE the delivery path (see note above) —
  updated in the same change as the rule file, never instead of the
  `instructions` entries.

## 3. MCP servers

**codegraph is GLOBAL.** The global `~/.config/opencode/opencode.jsonc`
declares the codegraph MCP server once; every project (and any directory)
gets it automatically — no per-project MCP entry needed (verbatim:
`references/snippets.md` §3).

- Do **not** add a `codegraph` entry to project `opencode.json` files — the
  global one wins/merges anyway and a duplicate is redundant.
- Project-local MCP entries remain valid for **project-specific** servers
  (e.g. `nx-mcp` in `angular-material-extended/opencode.json`) — those stay
  per project.
- **Key rules (MCP availability):** the global MCP server is always
  reachable; but the `codegraph_*` tools only *return useful data* when the
  active project has a `.codegraph/` index (codegraph resolves the nearest
  index at/above the queried path). Without an index, use Read/Grep instead
  or run `codegraph init` in the project — see the `codegraph-project-setup`
  skill.
- **Activation gotcha:** the running `opencode2` service caches resolved
  configs. After changing the global `opencode.jsonc` or a project's
  `opencode.json`, trigger a reload with `touch
  ~/.config/opencode/opencode.jsonc` (the daemon watches the global dir) or
  restart the session — otherwise `opencode2 mcp list` keeps reporting the
  old state.
- Adding another MCP server: global ones go into the global
  `opencode.jsonc`; project-specific ones via
  `opencode2 mcp add <name> -- <command…>` in the project. Remote servers
  use `--url` instead of a command.

## 4. CodeGraph per project (quick reference)

For the full runbook see the `codegraph-project-setup` skill: `codegraph init`
(index + gitignore), commit the gitignore, install the hook from that skill's
`templates/pre-commit.sh`, `git config core.hooksPath .githooks`, then verify
(`codegraph status`, `git hook run pre-commit` → `codegraph: index synced`).
**Exception — `agents-skills` itself:** markdown only (skills, rules, docs), so
no index and no hook there; the hook was removed 2026-10-08. Do not run this
runbook against the skills repo.

Status commands: `codegraph status | sync | index | explore | upgrade`.

## 5. New machine / new project bring-up

- **New machine:** install codegraph CLI (`npm i -g @colbymchenry/codegraph`),
  clone `git@github.com:reisi007/agents-skills.git`, wire the `skills` array
  (§2) **and the `instructions` array** (§2a) in the global `opencode.jsonc` —
  both entries are required (or symlink `~/.config/opencode/skills` → repo
  dir for the `skills` side). codegraph is declared once as a **global MCP
  server** (§3) — no per-project MCP entry for it.
- **New project:** follow `codegraph-project-setup` (init + hook + AGENTS.md +
  AGENTS.todo.md). Do NOT create new skills in the project — add them to
  agents-skills instead.

## 6. Commit convention (agents-skills repo)

**Separate Conventional Commits are the default** — one per self-contained change
(`feat(skill): …`). Amend is the exception, and only while the commit is still
unpushed:

- amend only your own not-yet-pushed HEAD — a message wording, a forgotten file,
  a typo in what you just wrote;
- once pushed, it is history: a new commit instead, because an amend changes the
  SHA and other projects record those SHAs as their `skills-marker` range
  (see the `skills-marker` skill);
- if a force-push is ever unavoidable: `--force-with-lease`, never bare
  `--force` — it refuses to clobber remote state you haven't seen. That this
  repo is private/single-user is not the reason; the marker SHAs are;
- never `git add -A`: explicit paths plus `git show --stat`.

This section is **not** an exception to the always-on `build-verify` rules — the
commit-per-task / push / watch-CI policy holds here unchanged. The `Verify:`
footer and the `nach-verify` flag apply as in every other repo.

## 7. Ownership rules (which skills live where)

| Skills | Location |
|---|---|
| Own skills (`ui-review`, `codegraph-project-setup`, `agent-config`, …) | `agents-skills/.agents/skills/` only |
| Always-on rules (`build-verify`) | `agents-skills/.agents/rules/` only, wired via the global `instructions` array (§2a) |
| Official/third-party packs installed by tools (daisyui, find-skills, stripe-*, …) | where the installer put them (`~/.agents/skills`, project `.agents/skills`, …) — not in agents-skills |
| Project-specific skills (nx-*, blog-beitrag, testimonial, …) | their project — not in agents-skills |

## 8. After pull: setup drift check

Every `git pull` (or fresh clone) in `agents-skills` can change what the local
machine needs. The repo is the source of truth; the machine is a copy that rots.
After pulling, diff what landed (`references/snippets.md` §5) and re-apply
setup if the source moved under you:

| Changed path | Setup step to re-check |
|---|---|
| `.agents/rules/*` (new or changed) | global `opencode.jsonc` `instructions` array covers every rule file (§2a) — a new rule file without an entry **silently contributes nothing** |
| `.agents/rules/*` (changed content) | update the inlined copies in the global `~/.config/opencode/AGENTS.md` in the same change — the §2a `instructions` mechanism is recorded as non-functional on v2.0.22, so it is not the delivery path |
| `.agents/skills/*` (new skill) | nothing to wire (the dir is already registered) — but verify the skill resolves in a fresh session |
| `agent-config/SKILL.md` (§2/§2a/§3) | `skills` paths, `instructions`, or MCP wiring may have changed — apply locally |
| `.githooks/*`, README setup section | re-run the changed step (hook path, clone URL, install command) — **`.githooks/` no longer exists in this repo** (markdown-only, hook removed 2026-10-08): nothing to re-run, and do not re-create it |
| none of the above | nothing to do |

Then `touch ~/.config/opencode/opencode.jsonc` so the daemon picks the change up
(§2a reloading), and verify once in a fresh session. Report drift before applying:
the global config is user-owned — apply it, don't just announce it, but say what
changed and why. The repo-root `AGENTS.md` enforces this check whenever work
happens inside `agents-skills`, because a trigger-based skill alone would be
skipped exactly when it is inconvenient.
