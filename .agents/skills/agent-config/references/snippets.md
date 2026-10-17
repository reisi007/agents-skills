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

## 2. Always-on rules (`instructions` array — empty on this setup)

```jsonc
// ~/.config/opencode/opencode.jsonc
// ALWAYS-ON RULES: files injected as `Instructions from: <path>`
// into every session's system prompt. See agents-skills/.agents/skills/agent-config
// §2a. build-verify removed 2026-10-07 on user order (on-demand per
// project/session only) — add new rule files here to make them always-on.
// After changing this array: `touch` this file so the opencode service reloads.
"instructions": [],
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

## 4. Commit convention (agents-skills repo)

```sh
cd ~/dev/agents-skills && git add <explicit path>... \
  && git show --stat \
  && git commit -F - \
  && git push            # separate commits are the default
                          # amend only an unpushed HEAD: git commit --amend --no-edit
                          # a force-push, if ever unavoidable: --force-with-lease
```

## 5. After-pull drift check (what landed)

```sh
cd ~/dev/agents-skills && git log --oneline -5   # what landed?
git diff HEAD@{1} HEAD --stat                     # what exactly changed?
```
