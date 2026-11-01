# Context caps — reduced-window model aliases

Detail for the cap rule in `SKILL.md` § "Variants disabled". A window far larger
than the work needs is not free capacity: compaction starts late, the transcript
drifts, and the prompt grows into room nothing needs. The cap is a **client-side
budget** — the provider keeps accepting its full window, OpenCode compacts
earlier and treats the smaller number as the limit.

## Mechanism

Declare an alias: same catalog `modelID`, new key, only `limit.context` lower.

```jsonc
"providers": {
  "opencode-go": {
    "models": {
      "deepseek-v4.1-flash-500k": {
        "modelID": "deepseek-v4.1-flash",
        "name": "DeepSeek V4.1 Flash (500k)",
        "limit": { "context": 500000 }
      }
    }
  }
}
```

Measured 2026-11-01 against `opencode api get /api/model`: the alias inherits
`capabilities`, `cost`, `variants`, `compatibility`, `family`, `package` and every
limit key it does not override (`output`) from the catalog model — verified on
`opencode-go/deepseek-v4.1-flash` (1,000,000 context / 384,000 output). Nothing
else has to be repeated.

A catalog model that also carries `limit.input` has a second cap: lower it in the
same object when it exceeds the new context.

## Why not a variant, why not a plugin

- **Not `#variant`:** a variant carries only `settings`, `headers` and `body` —
  `limit` is not part of its shape, so the window cannot be expressed there.
  `variants: none` stands unchanged.
- **Not a plugin:** a server plugin can emit aliases (`ctx.model.transform`) and
  can target selected model IDs. The catalog-wide variant was considered and
  rejected: 27 catalog models were ≥500k on 2026-11-01, so it would flood the
  picker. The config does the same thing declaratively, reloads on save, and
  keeps every alias a deliberate entry. A plugin earns its place when the rule is
  **global** — `model.limit.context = Math.min(…)` across the catalog — which
  gives up the full-window option entirely.

## When, and how many

- **Bring-up** of a machine (`agent-config` §5) and every **role assignment**:
  one alias per cap in use, for the models the config actually selects — not for
  the catalog.
- **Split:** main agents (`plan`, `build`) take the larger cap, subagents the
  smaller one; a subagent's task is narrow, its transcript should be too. A main
  agent that also serves as a subagent keeps `mode: all`.
- **Downward only.** An alias above the provider's window is a number the client
  budgets against and the provider rejects.
- Naming: `<model-id>-<cap>k`, `(…k)` in `name`. Two steps cover the realistic
  cases; a ladder of every size is clutter.

## Alternative, and verify

`compaction.buffer` (`"50%"` compacts at half the window) needs no alias, but it
applies to every model and leaves `limit` untouched. Use the percentage for one
shape of model, the alias when the choice must hold per session or per agent.

```sh
opencode reload
opencode api get /api/model \
  | jq -r '.data[] | select(.id|endswith("-500k")) | "\(.id) \(.limit.context)/\(.limit.output)"'
```
