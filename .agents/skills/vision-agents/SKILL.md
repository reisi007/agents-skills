---
name: Vision Agents
description: 'TRIGGER when a visual judgement is subjective, domain-specific, or too fine-grained to trust your own first read — design/aesthetic/intent review — or when you want a stronger second opinion on complex image details. Routine screenshots, EXIF-relevant visual details and image categorisation need NO skill (every configured model is vision-capable). Reference for the locked-down vision-creative subagent and the escalate-don''t-squint rule.'
---

# Vision Agents — creative, plus the escalation rule

**Premise: every configured model is vision-capable.** Image input is a *hard
requirement* for the root `model` and for every `agents.<role>.model` — see
`update-models` → "Hard requirements". So the main agent reads images itself.
There is no capability gap to bridge.

(`vision-technical` was removed for exactly that reason — history in [`references/notes.md`](references/notes.md). So was `document`: removed 2026-10-08, because no configured model has `pdf` input and the role had never been used — same file.)

What remains is **role separation, not capability separation**: one `mode: subagent`
agent that is a read-only specialist and second opinion. Max ~10 images per call —
split larger batches.

| Agent | Role | Use when |
|---|---|---|
| `vision-creative` | creative judgement | Design/aesthetic review, mood & meaning, whether visuals convey intent, and complex fine-grained detail reads. |

> Model is not pinned in this skill — set `agents.<role>.model` in `~/.config/opencode/opencode.jsonc` and let the `update-models` skill choose/refresh it. Per-role prefs: `vision-creative` = image + video, strongest vision model wins.

## PDFs — no path

Image input and PDF input are **separate capabilities** (`capabilities.input`
lists them independently). A model can be vision-capable and still unable to read
a PDF — never assume "it can see images, so it can read the PDF".

The `document` role existed for exactly that gap and was **removed 2026-10-08**
(user decision, never used). Since 2026-10-16 `vision-creative` runs on
`opencode-go/glm-5.3-flash`, which **does** carry `pdf` — but there is still no
`document` role and none is to be re-added. Do not route a PDF to
`vision-creative` on your own: a PDF path is a new user decision, not a restore
(history in [`references/notes.md`](references/notes.md)).

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
4. Batch by state → viewport → route.

**Who to ask:** `vision-creative` for aesthetic, intent, and fine-detail reads —
it holds the strongest vision model. A PDF is **not** a vision question (see
"PDFs — no path" above).

## Shared lockdown

The agent's permission fence (see `references/agents.jsonc`):

```jsonc
"permissions": [
  { "action": "read",     "resource": "*", "effect": "allow" },
  { "action": "edit",     "resource": "*", "effect": "deny"  },
  { "action": "shell",    "resource": "*", "effect": "deny"  },
  { "action": "subagent", "resource": "*", "effect": "deny"  },
  { "action": "webfetch", "resource": "*", "effect": "deny"  },
  { "action": "websearch","resource": "*", "effect": "deny"  }
]
```

- `read: allow` — can read image files from disk via the `read` tool.
- `edit/shell/subagent/webfetch/websearch: deny` — cannot mutate, run commands, delegate, or fetch remotely.
- `mode: subagent` — always run via delegation, never as main agent.
- No `external_directory` overrides — inherits global username isolation (`/Users/<user>` only).

## When to delegate

- **Routine screenshots / EXIF details / categorising** → **nobody.** Read them
  yourself; this is what a vision-capable model is for.
- **Design, aesthetics, mood, intent, "which variant feels more premium?"** →
  `vision-creative`.
- **Fine-grained or ambiguous detail, high-stakes visual call** → `vision-creative`
  (escalation, see above).
- **PDFs / reports / rendered pages** → **nobody.** No role reads PDFs in this
  setup (see "PDFs — no path"); a *rendered page screenshot* is an image and goes
  to `vision-creative`.

Do **not** use them for code, text-only, or file-writing tasks.

## Apply / port

Copy the `agents` block from `references/agents.jsonc` into `~/.config/opencode/opencode.jsonc` under `agents` and add a `model` per role:

```jsonc
// ~/.config/opencode/opencode.jsonc
"agents": {
  "vision-creative": { "model": "opencode-go/<chosen>", /* ... */ }
}
```

Then run the `update-models` skill to pick the concrete models (it adds
`// updated: YYYY-MM-DD` which it uses to detect staleness), `touch ~/.config/opencode/opencode.jsonc`
and verify with `opencode service status`.

## Reference files

- `references/agents.jsonc` — copy-paste `agents` definition for the agent.
- `references/notes.md` — why the roles exist in this shape (history, rationale).
