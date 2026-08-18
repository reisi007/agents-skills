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

```jsonc
// ~/.config/opencode/opencode.jsonc
"mcp": {
  "servers": {
    "codegraph": {
      "type": "local",
      "command": ["codegraph", "serve", "--mcp"],
      "disabled": false
    }
  }
}
```

- `codegraph` is the only globally configured MCP server. It serves **any**
  active project — there is no per-project MCP config.
- **Key rule (MCP availability):** the `codegraph_*` tools (e.g.
  `codegraph_explore`) only work while the active project has a `.codegraph/`
  index. Fresh project without index ⇒ tools unavailable. Fix by running
  `codegraph init` — see the `codegraph-project-setup` skill.
- Adding another MCP server: edit the `mcp.servers` object in the global
  config (or `opencode2 mcp add --global …`). Local servers use `type:
  "local"` + `command` array.

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
  symlink `~/.config/opencode/skills` → repo dir). Keep the MCP server block.
- **New project:** follow `codegraph-project-setup` (init + hook + AGENTS.md +
  AGENTS.todo.md). Do NOT create new skills in the project — add them to
  agents-skills instead.

## 6. Ownership rules (which skills live where)

| Skills | Location |
|---|---|
| Own skills (`ui-review`, `codegraph-project-setup`, `agent-config`, …) | `agents-skills/.agents/skills/` only |
| Official/third-party packs installed by tools (daisyui, find-skills, stripe-*, …) | where the installer put them (`~/.agents/skills`, project `.agents/skills`, …) — not in agents-skills |
| Project-specific skills (nx-*, blog-beitrag, testimonial, …) | their project — not in agents-skills |