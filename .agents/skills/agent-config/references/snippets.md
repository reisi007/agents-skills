# Agent Config — verbatim config snippets

Copy-paste source for the blocks summarized in [`../SKILL.md`](../SKILL.md).
`<user>` is a placeholder for the local username; `~` resolves to that user's
home — never a concrete machine layout. Decisions and wiring rules live in
`SKILL.md`; this file carries only the literal text.

## 1. Skills repo registration (`skills` array)

```jsonc
// ~/.config/opencode/opencode.jsonc
"skills": {
  "paths": [
    "/Users/<user>/dev/agents-skills/.agents/skills"
  ]
},
```

## 2. Always-on rules (`instructions` array)

```jsonc
// ~/.config/opencode/opencode.jsonc
"instructions": [
  "/Users/<user>/dev/agents-skills/.agents/rules/build-verify.md",
  "/Users/<user>/dev/agents-skills/.agents/rules/ask.md"
],
```

## 3. CodeGraph global MCP server

```jsonc
// ~/.config/opencode/opencode.jsonc
"mcp": {
  "codegraph": {
    "type": "local",
    "command": ["codegraph", "serve", "--mcp"],
    "enabled": true
  }
},
```

## 4. Commit convention (agents-skills repo)

```sh
cd ~/dev/agents-skills && git add -A \
  && git commit --amend --no-edit \
  && git push --force-with-lease
```

## 5. After-pull drift check (what landed)

```sh
cd ~/dev/agents-skills && git log --oneline -5   # what landed?
git diff HEAD@{1} HEAD --stat                     # what exactly changed?
```
