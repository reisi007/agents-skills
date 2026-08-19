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

**Per-project, never global.** The global `~/.config/opencode/opencode.jsonc`
has **no** `mcp` section. MCP servers are declared per project, so every
project carries its own `opencode.json`:

```jsonc
// ~/dev/<project>/opencode.json
{
  "mcp": {
    "servers": {
      "codegraph": {
        "type": "local",
        "command": ["codegraph", "serve", "--mcp"]
      }
    }
  }
}
```

- Canonical way to add it: `cd ~/dev/<project> && opencode2 mcp add codegraph -- codegraph serve --mcp`
  (writes/merges `opencode.json` in the project; `--global` would write the
  global config instead). The CLI writes the `mcp.servers.<name>` wrapper; the
  flat `mcp.<name>` form is also read — both are valid.
- **Key rules (MCP availability):** the `codegraph_*` tools (e.g.
  `codegraph_explore`) only work while the active project has a `.codegraph/`
  index **and** a per-project `opencode.json` MCP entry. Missing either ⇒
  tools unavailable. Fix by running `codegraph init` + the MCP add — see the
  `codegraph-project-setup` skill.
- **Activation gotcha:** the running `opencode2` service caches resolved
  per-project configs. After adding/changing a project's `opencode.json`,
  trigger a reload with `touch ~/.config/opencode/opencode.jsonc` (the daemon
  watches the global dir) or restart the session — otherwise `opencode2 mcp
  list` keeps reporting "No MCP servers configured" for that project.
- Adding another MCP server: same per-project flow
  (`opencode2 mcp add <name> -- <command…>` in the project). Remote servers
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
  symlink `~/.config/opencode/skills` → repo dir). MCP servers are per project
  (§3) — the global config stays without an `mcp` section.
- **New project:** follow `codegraph-project-setup` (init + hook + AGENTS.md +
  AGENTS.todo.md). Do NOT create new skills in the project — add them to
  agents-skills instead.

## 6. Ownership rules (which skills live where)

| Skills | Location |
|---|---|
| Own skills (`ui-review`, `codegraph-project-setup`, `agent-config`, …) | `agents-skills/.agents/skills/` only |
| Official/third-party packs installed by tools (daisyui, find-skills, stripe-*, …) | where the installer put them (`~/.agents/skills`, project `.agents/skills`, …) — not in agents-skills |
| Project-specific skills (nx-*, blog-beitrag, testimonial, …) | their project — not in agents-skills |