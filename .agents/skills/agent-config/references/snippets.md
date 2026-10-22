# Agent Config — verbatim config snippets

Copy-paste source for the blocks summarized in [`../SKILL.md`](../SKILL.md).
`<user>` is a placeholder for the local username; `~` resolves to that user's
home — never a concrete machine layout. Decisions and wiring rules live in
`SKILL.md`; this file carries only the literal text.

## 1. Skills repo registration (`skills` array)

```jsonc
// ~/.config/opencode/opencode.jsonc
"skills": [
  "/Users/<user>/dev/agents-skills/.agents/skills"
],
```

## 2. Always-on rules (inlined into an `AGENTS.md` — no config key)

```
// ~/.config/opencode/AGENTS.md  — the file that carries always-on text
// ALWAYS-ON RULES: text inlined here reaches every session as
// `Instructions from: <path>`. Keep the source in agents-skills/.agents/rules/*
// and inline the duty (short form); see agents-skills/.agents/skills/agent-config
// §2a. After editing: `touch ~/.config/opencode/opencode.jsonc` so the
// opencode service reloads.
```

## 3. CodeGraph global MCP server

```jsonc
// ~/.config/opencode/opencode.jsonc
"mcp": {
  "servers": {
    "codegraph": {
      "type": "local",
      "command": ["codegraph", "serve", "--mcp"],
      "disabled": false,
      "codemode": false
    }
  }
},
```

Merge into the existing `mcp.servers` map — servers already there (e.g. `rea`)
stay untouched.

## 4. Commit convention (agents-skills repo)

```sh
cd ~/dev/agents-skills && git add <explicit path>... \
  && git show --stat \
  && git commit -F - -- <explicit path>... \
  && git push            # separate commits are the default
                          # the paths are the mechanism in a shared tree
                          # amend only an unpushed HEAD: git commit --amend --no-edit
                          # a force-push, if ever unavoidable: --force-with-lease
```

## 5. After-pull drift check (what landed)

```sh
cd ~/dev/agents-skills && git log --oneline -5   # what landed?
git diff HEAD@{1} HEAD --stat                     # what exactly changed?
```
