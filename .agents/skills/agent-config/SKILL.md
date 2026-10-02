---
name: Agent Config
description: TRIGGER when setting up a new machine/agent, wiring the global OpenCode configuration (opencode.jsonc, MCP servers, skills array), registering the central skills repo (agents-skills), or answering "how is my agent configured" / "where do my skills live" / "how do I add an MCP server". Reference for the single source of truth of this developer's agent tooling.
---

# Agent Config — global setup, single source of truth

Everything about this developer's agent tooling: where config lives, how the
skills repo is registered, how MCP servers are wired, and how to bring a new
machine/project online.

## 1. Global config files

| File | Purpose |
|---|---|
| `~/.config/opencode/opencode.jsonc` | Global OpenCode config: permissions, agents, MCP servers, `skills` array |
| `~/.config/opencode/AGENTS.md` | Global agent instructions (CodeGraph usage block, …) |
| `~/dev/agents-skills/` | **Central skills repo** (GitHub `reisi007/agents-skills`) — the only home of own skills |
| `~/.agents/skills/` | Cross-agent compat source for third-party/official skills (daisyui, find-skills, blog-beitrag, testimonial symlinks) — NOT for own skills |

## 2. Skills repo registration (the `skills` array)

Own skills live in **one** git repo, not per project:

```jsonc
// ~/.config/opencode/opencode.jsonc
"skills": {
  "paths": [
    "/Users/<user>/dev/agents-skills/.agents/skills"
  ]
},
```

- Point this at the cloned repo's `.agents/skills` directory (structure
  follows the portable Agent Skills spec, so other agents can consume the same
  dir).
- OpenCode also **auto-discovers** project-local `.agents/skills`,
  `.opencode/skills`, `.claude/skills` (compat) — but the convention here is:
  **no own skills inside projects**; everything own lives in agents-skills.
- Adding a new own skill: create `<agents-skills>/.agents/skills/<id>/SKILL.md`
  (frontmatter `name` + `description`, kebab-case ID = directory name), commit,
  push. No config change needed — the dir is already registered.
- Skill precedence (low → high): builtin → `.claude/skills` → `.agents/skills`
  (compat) → `~/.config/opencode/skills` → project `.opencode/skills` →
  explicit `skills` array entries. The repo entry therefore wins over any
  leftover project copy. Same ID in two sources: later source wins.

## 2a. Always-on rules (the `instructions` array) — NOT the same as a skill

A skill is **trigger-based**: its `description` has to match before its body is
read. That is the right mechanism for detail that is only needed sometimes, and
the wrong one for a rule that must hold in *every* session (the build/verify
flow: pull first, never implement in the orchestrator, always verify with a
second subagent, commit after every verify round). A rule that lives only in a
skill is a rule that gets skipped exactly when it is inconvenient.

For those, the config has a second key — `instructions`, "Additional instruction
files or patterns to include":

```jsonc
// ~/.config/opencode/opencode.jsonc
"instructions": [
  "/Users/<user>/dev/agents-skills/.agents/rules/build-verify.md"
],
```

- **Absolute paths and `~/` paths both work**; relative paths and globs are
  resolved against the project (an absolute glob works too — it is globbed with
  `cwd = dirname`). Remote `https://` URLs are fetched with a 5 s timeout.
- The file's content is injected as `Instructions from: <path>` into the system
  prompt, alongside every `AGENTS.md` — it is **not** read on demand, so it costs
  context in every session. Keep it short: one screen, no examples, no history.
- That is the split: `.agents/rules/` = always in context, short and absolute;
  `.agents/skills/` = on demand, with the reasoning, tables and evidence. The
  rule file points at the skill; it does not duplicate it.
- Adding a second always-on rule: new file in `.agents/rules/` + one more entry
  in the array. Nothing else to wire.
- **Reloading:** like any config change, the running `opencode2` service caches
  resolved config — `touch ~/.config/opencode/opencode.jsonc` or restart the
  session (see §3 for the same gotcha on MCP). Verify the wiring **once** after
  setup: in a fresh session, ask the agent to repeat the rule file's first
  heading without reading the file — if it can, the entry resolved. A path that
  does not exist **silently contributes nothing**, so a wrong path looks exactly
  like a working setup until you test it.
- **Do not put an always-on rule into the global `AGENTS.md` just because it is
  easier** — that file is not in this repo and not versioned with it. The
  `instructions` path keeps the rule in `agents-skills`, versioned and
  reviewable, which is the whole point of the repo.

## 3. MCP servers

**codegraph is GLOBAL.** The global `~/.config/opencode/opencode.jsonc`
declares the codegraph MCP server once; every project (and any directory)
gets it automatically — no per-project MCP entry needed:

```jsonc
// ~/.config/opencode/opencode.jsonc
"mcp": {
  "codegraph": {
    "type": "local",
    "command": ["codegraph", "serve", "--mcp"],
    "enabled": true
  }
}
```

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

For the full runbook see the `codegraph-project-setup` skill. One-liner
checklist:

1. `codegraph init` (creates `.codegraph/` + tracked-able `.codegraph/.gitignore`)
2. `git add .codegraph/.gitignore && git commit …`
3. `mkdir -p .githooks && cp <agents-skills>/.agents/skills/codegraph-project-setup/templates/pre-commit.sh .githooks/pre-commit && chmod +x .githooks/pre-commit`
4. `git config core.hooksPath .githooks`
5. Verify: `codegraph status`, `git hook run pre-commit` → `codegraph: index synced`

Status commands: `codegraph status | sync | index | explore | upgrade`.

## 5. New machine / new project bring-up

- **New machine:** install codegraph CLI (`npm i -g @colbymchenry/codegraph`),
  clone `git@github.com:reisi007/agents-skills.git`, set the `skills` array in
  `~/.config/opencode/opencode.jsonc` to the repo's `.agents/skills` (or add a
  symlink `~/.config/opencode/skills` → repo dir) **and the `instructions` array
  to `.agents/rules/*.md`** (§2a) — both entries are required, one gives the
  skills, the other the always-on rules. codegraph is declared once
  as a **global MCP server** in the global `opencode.jsonc` (§3) — no
  per-project MCP entry for it.
- **New project:** follow `codegraph-project-setup` (init + hook + AGENTS.md +
  AGENTS.todo.md). Do NOT create new skills in the project — add them to
  agents-skills instead.

## 6. Commit convention (agents-skills repo)

Own-repo, single-developer workflow: changes are **amended into the latest
commit and force-pushed**, not accumulated as separate commits:

```sh
cd ~/dev/agents-skills && git add -A \
  && git commit --amend --no-edit \
  && git push --force-with-lease
```

- Use `--force-with-lease` (not bare `--force`) — refuses to clobber remote
  state you haven't seen.
- This repo is private/single-user, so force-push is safe here. Do NOT apply
  amend+force-push to shared/team repos.
- Exception: brand-new, self-contained work the user explicitly wants as its
  own commit may still get a fresh commit — default to amend unless asked.
- **This section is the documented exception to the always-on `build-verify`
  rules** (commit per task, push and watch CI): in `agents-skills` the amend +
  `--force-with-lease` workflow wins. The `Verify:` footer and the `nach-verify`
  flag still apply — they change the message, not the branch policy.

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
After pulling, diff what landed and re-apply setup if the source moved under you:

```sh
cd ~/dev/agents-skills && git log --oneline -5   # what landed?
git diff HEAD@{1} HEAD --stat                     # what exactly changed?
```

| Changed path | Setup step to re-check |
|---|---|
| `.agents/rules/*` (new or changed) | global `opencode.jsonc` `instructions` array covers every rule file (§2a) — a new rule file without an entry **silently contributes nothing** |
| `.agents/skills/*` (new skill) | nothing to wire (the dir is already registered) — but verify the skill resolves in a fresh session |
| `agent-config/SKILL.md` (§2/§2a/§3) | `skills` paths, `instructions`, or MCP wiring may have changed — apply locally |
| `.githooks/*`, README setup section | re-run the changed step (hook path, clone URL, install command) |
| none of the above | nothing to do |

Then `touch ~/.config/opencode/opencode.jsonc` so the daemon picks the change up
(§2a reloading), and verify once in a fresh session. Report drift before applying:
the global config is user-owned — apply it, don't just announce it, but say what
changed and why. The repo-root `AGENTS.md` enforces this check whenever work
happens inside `agents-skills`, because a trigger-based skill alone would be
skipped exactly when it is inconvenient.
