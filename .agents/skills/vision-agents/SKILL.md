---
name: Vision Agents
description: TRIGGER when analyzing images, screenshots, EXIF data, UI renders, or PDFs/documents visually — need vision-technical (screenshots/EXIF), vision-creative (design/aesthetics), or document (PDF/report layout). Reference for the three locked-down vision subagents.
---

# Vision Agents — technical / creative / document

Three `mode: subagent` agents that can **only read**. They never edit, run shell, spawn subagents, or fetch the web. Max ~10 images per call — split larger batches.

| Agent | Model | Use when |
|---|---|---|
| `vision-technical` | `opencode-go/mimo-v2.5` | Screenshots, EXIF-relevant visual details, image categorization, technical QA (e.g. ui-review). Detached, factual. |
| `vision-creative` | `opencode-go/glm-5.3-flash` | Design/aesthetic review, mood & meaning, whether visuals convey intent. Creative judgment. |
| `document` | `opencode-go/glm-5.3-flash` | PDFs, rendered pages, reports — layout, readability, appearance (not photos). |

Author agent intentionally omitted (owner preference).

## Shared lockdown

All three share the same permission fence (see `references/agents.jsonc`):

```jsonc
"permission": { "read": "allow", "edit": "deny", "bash": "deny", "subagent": "deny", "webfetch": "deny", "websearch": "deny" }
```

- `read: allow` — can read images/PDFs from disk via `read` tool.
- `edit/bash/subagent/webfetch/websearch: deny` — cannot mutate, run commands, delegate, or fetch remotely.
- `mode: subagent` — always run via delegation, never as main agent.
- No `external_directory` overrides — inherits global username isolation (`/Users/<user>` only).

## When to delegate

- **Screenshots / UI**: `vision-technical` (with checklist from `ui-review` skill). Batch by state → viewport → route, 10 images max.
- **Mood / branding / intent**: `vision-creative` (e.g. "does this hero convey trust?", "which variant feels more premium?").
- **PDFs / docs**: `document` (pass rendered PDF pages as images, or let it `read` the PDF directly if supported).

Do **not** use them for code, text-only, or file-writing tasks.

## Apply / port

Copy the `agent` block from `references/agents.jsonc` into `~/.config/opencode/opencode.jsonc` under `agent`:

```jsonc
// ~/.config/opencode/opencode.jsonc
"agent": {
  "vision-technical": { ... },
  "vision-creative": { ... },
  "document": { ... }
}
```

Then `touch ~/.config/opencode/opencode.jsonc` and verify with `opencode2 service status`.

To update models, keep the `// updated: YYYY-MM-DD` trailing comment on each `model` line (used by `model-updater` skill to detect staleness).

## Reference files

- `references/agents.jsonc` — copy-paste `agent` definitions for the three agents.
