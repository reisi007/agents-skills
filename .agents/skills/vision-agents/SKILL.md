---
name: Vision Agents
description: TRIGGER when a visual judgement is subjective, domain-specific, or too fine-grained to trust your own first read — design/aesthetic/intent review (vision-creative) or PDF/report layout (document) — or when you want a second, stronger opinion on complex image details. Routine screenshots, EXIF-relevant visual details and image categorisation need NO skill, because every configured model is vision-capable and reads them itself. Reference for the two locked-down vision subagents and the escalate-don't-squint rule.
---

# Vision Agents — creative / document, plus the escalation rule

**Premise: every configured model is vision-capable.** Image input is a *hard
requirement* for the root `model` and for every `agent.<role>.model` — see
`model-updater` → "Hard requirements". So the main agent reads images itself.
There is no capability gap to bridge.

> `vision-technical` was removed for exactly that reason. Reading a screenshot,
> pulling out EXIF-relevant visual details, and categorising an image are *your*
> job now — do them inline, don't delegate them.

What remains is **role separation, not capability separation**: two `mode: subagent`
agents that are read-only specialists and second opinion. Max ~10 images per call —
split larger batches.

| Agent | Role | Use when |
|---|---|---|
| `vision-creative` | creative judgement | Design/aesthetic review, mood & meaning, whether visuals convey intent, and complex fine-grained detail reads. |
| `document` | document domain | PDFs, rendered pages, reports — layout, readability, appearance (not photos). |

> Model is not pinned in this skill — set `agent.<role>.model` in `~/.config/opencode/opencode.jsonc` and let the `model-updater` skill choose/refresh it. Per-role prefs: `vision-creative` = image + video, strongest vision model wins; `document` = image **and** `pdf` capability.

Author agent intentionally omitted (owner preference).

## Vision ≠ PDF

Image input and PDF input are **separate capabilities** (`capabilities.input`
lists them independently). A model can be vision-capable and still unable to read
a PDF — that is exactly why the `document` role exists and why it may keep a
different model than everything else. Never assume "it can see images, so it can
read the PDF".

## Escalate, don't squint

This is the replacement for `vision-technical`, and the answer to "should I just
ask a better model how it sees this?" — **yes, when the read is complex.** Not as
a routine, and not because you cannot see.

**Default: read the image yourself.** Escalate when:

- You looked twice and still disagree with yourself about what is there.
- The detail is fine-grained or the image is downscaled — exact spacing, a hairline
  border, faint contrast, small text. (Screenshot sections instead of a tall
  full-page PNG — see `ui-review` → `references/harness.md`.)
- The call is subjective **and** consequential: ship/no-ship, brand, accessibility.
- You are about to guess.

**How to ask** — attach the actual image, never a description of it:

1. Pass the image file(s) plus the file name so findings can be cited.
2. One concrete question, not "what do you see?" — e.g. "is the 8px gap between
   the card title and the meta row consistent across these three cards?"
3. Ask what it would look at to be more certain, and for a confidence read.
4. 10 images max per call; batch by state → viewport → route.

**Who to ask:** `vision-creative` for aesthetic, intent, and fine-detail reads.
`document` for anything that is a PDF or a rendered page. For a purely factual
"what exactly is in this corner" question, `vision-creative` is still the right
target — it holds the strongest vision model.

## Shared lockdown

Both agents share the same permission fence (see `references/agents.jsonc`):

```jsonc
"permission": { "read": "allow", "edit": "deny", "bash": "deny", "subagent": "deny", "webfetch": "deny", "websearch": "deny" }
```

- `read: allow` — can read images/PDFs from disk via `read` tool.
- `edit/bash/subagent/webfetch/websearch: deny` — cannot mutate, run commands, delegate, or fetch remotely.
- `mode: subagent` — always run via delegation, never as main agent.
- No `external_directory` overrides — inherits global username isolation (`/Users/<user>` only).

## When to delegate

- **Routine screenshots / EXIF details / categorising** → **nobody.** Read them
  yourself; this is what a vision-capable model is for.
- **Design, aesthetics, mood, intent, "which variant feels more premium?"** →
  `vision-creative`.
- **Fine-grained or ambiguous detail, high-stakes visual call** → `vision-creative`
  (escalation, see above).
- **PDFs / reports / rendered pages** → `document` (pass rendered pages as images,
  or let it `read` the PDF directly if the model has `pdf` capability).

Do **not** use them for code, text-only, or file-writing tasks.

## Apply / port

Copy the `agent` block from `references/agents.jsonc` into `~/.config/opencode/opencode.jsonc` under `agent` and add a `model` per role:

```jsonc
// ~/.config/opencode/opencode.jsonc
"agent": {
  "vision-creative": { "model": "opencode-go/<chosen>", /* ... */ },
  "document": { "model": "opencode-go/<chosen>", /* ... */ }
}
```

Then run the `model-updater` skill to pick the concrete models (it adds
`// updated: YYYY-MM-DD` which it uses to detect staleness), `touch ~/.config/opencode/opencode.jsonc`
and verify with `opencode2 service status`.

## Reference files

- `references/agents.jsonc` — copy-paste `agent` definitions for the two agents.
