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
"skills": [
  "/Users/<user>/dev/agents-skills/.agents/skills"
],
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
  symlink `~/.config/opencode/skills` → repo dir). codegraph is declared once
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

## 6. Ownership rules (which skills live where)

| Skills | Location |
|---|---|
| Own skills (`ui-review`, `codegraph-project-setup`, `agent-config`, …) | `agents-skills/.agents/skills/` only |
| Official/third-party packs installed by tools (daisyui, find-skills, stripe-*, …) | where the installer put them (`~/.agents/skills`, project `.agents/skills`, …) — not in agents-skills |
| Project-specific skills (nx-*, blog-beitrag, testimonial, …) | their project — not in agents-skills |