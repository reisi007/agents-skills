---
name: Vision Agents
description: TRIGGER when analyzing images, screenshots, EXIF data, UI renders, or PDFs/documents visually — need vision-technical (screenshots/EXIF), vision-creative (design/aesthetics), or document (PDF/report layout). Reference for the three locked-down vision subagents.
---

# Vision Agents — technical / creative / document

Three `mode: subagent` agents that can **only read**. They never edit, run shell, spawn subagents, or fetch the web. Max ~10 images per call — split larger batches.

| Agent | Role | Use when |
|---|---|---|
| `vision-technical` | technical QA | Screenshots, EXIF-relevant visual details, image categorization, technical QA (e.g. ui-review). Detached, factual. |
| `vision-creative` | creative | Design/aesthetic review, mood & meaning, whether visuals convey intent. Creative judgment. |
| `document` | document | PDFs, rendered pages, reports — layout, readability, appearance (not photos). |

> Model is not pinned in this skill — set `agent.<role>.model` in `~/.config/opencode/opencode.jsonc` and let the `model-updater` skill choose/refresh it (per-role prefs: `vision` = image/video required, `document` = nice-to-have).

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

Copy the `agent` block from `references/agents.jsonc` into `~/.config/opencode/opencode.jsonc` under `agent` and add a `model` per role:

```jsonc
// ~/.config/opencode/opencode.jsonc
"agent": {
  "vision-technical": { "model": "opencode-go/<chosen>", /* ... */ },
  "vision-creative": { "model": "opencode-go/<chosen>", /* ... */ },
  "document": { "model": "opencode-go/<chosen>", /* ... */ }
}
```

Then run the `model-updater` skill to pick the concrete models (it adds `// updated: YYYY-MM-DD` which it uses to detect staleness), `touch ~/.config/opencode/opencode.jsonc` and verify with `opencode2 service status`.

## Reference files

- `references/agents.jsonc` — copy-paste `agent` definitions for the three agents.
