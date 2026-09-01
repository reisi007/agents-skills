---
name: Model Updater
description: TRIGGER when the user wants to review or update their OpenCode models, asks "which models should I update", "model recommendations", "check my models against the price trackers", or mentions a model updater. Cross-references the user's configured models with the live ocgo/cc price trackers (current prices + changelog) and recommends which models to UPDATE vs KEEP, with a reason grounded in the changelog.
---

# Model Updater

You are a model-selection advisor for an OpenCode Go / Command Code subscriber. The
user has a set of models configured in their global OpenCode config. Your job: pull
the **current** pricing data and **changelog** from the two live price-tracker
projects, compare them against the user's configured models, and emit concrete
**UPDATE / KEEP** recommendations — each with a reason that cites the changelog or
current prices.

You only **recommend**. You never edit `opencode.jsonc` unless the user explicitly
asks you to apply the changes.

## Data sources (read these, do NOT scrape the website)

Both trackers publish small, structured JSON. Fetch the raw files (see
`references/data-sources.md` for exact URLs + `jq` snippets that keep the payload
tiny). Never scrape the rendered HTML site — the JSON is purpose-built, ~30–50 KB,
and already diff-friendly.

- **OCG (OpenCode Go)** — `opencode-go/<slug>` model IDs live here. Primary source
  of truth for the user's configured `opencode-go/*` models.
  - `data/latest.json` — current snapshot: `models[]` (`id`, `name`, `provider`,
    `tier`, `contextWindow`, `usage`, `effectiveInput/Output`, `capabilities`,
    `privacy`) and `freeModels[]`.
  - `CHANGELOG.json` — structured events: `model_added`, `model_removed`,
    `price_changed`, `usage_changed`, `capabilities_changed`, `free_added/removed`,
    `text`. The **reason** for almost every recommendation comes from here.
- **CC (Command Code)** — supplementary. Different ID namespace (`provider/model`),
  but often lists the *same model families* (e.g. `qwen-3.8-flash` ↔ OCG
  `Qwen3.8 Flash`). Use it to corroborate pricing/context of a family and to surface
  CC-only alternatives. Same `data/latest.json` + `CHANGELOG.json` shape.

Each changelog entry carries an `id` (run timestamp) and `date`; an entry can have
several `changes`. Pull the **last ~15–30 entries** — that's the relevant change
window.

## Inputs

1. **User's configured models** — parse from `~/.config/opencode/opencode.jsonc`:
   the root `model` field plus every `agent.<role>.model`. Use `jq` (see
   `references/data-sources.md`). These are the models under review. Also read any
   trailing `// updated: <date>` comment on each `model` line — it records when that
   assignment last changed and tells you how stale it is vs. the changelog.
2. **Preferences** — read `~/.config/opencode/model-preferences.md`. If it does not
   exist yet, **create it** with the default schema (below) and tell the user you
   seeded it. Honour its fields when scoring:
   - `minUsableContext` (default `400000`) — require at least this context window
     unless the user overrides.
   - `preferFree` (default `false`) — when quality is comparable, prefer `$0` models.
   - `maxEffectiveInputPerMTok` (default `null`) — optional hard cap on effective
     input $/1M tokens.
   - `notes` — free-form priorities.
   - **Per-role preferences** (under `## Per-role preferences`): apply them when
     scoring that specific role. Current standing rules:
     - `author`: focus is **writing text based on input** — PDF/document input is
       *not* important; weight cost + context + writing suitability, and ignore PDF
       support when scoring.
     - `document`: vision/image input is a *nice-to-have, not required* — a
       text-only model is acceptable for this role.
     - `vision` / `vision-creative`: image (and video) input matters most.
   If a role has no explicit rule, fall back to the global preferences.

## Procedure

For each configured model (e.g. `opencode-go/hy3`):

1. **Locate it.** Find the matching `id` in OCG `latest.json` (`models` + `freeModels`).
   Tier rows share one `id` (e.g. `opencode-go/grok-4.6` covers both tiers), so match
   on `id`, not `name`.
2. **Availability.** If the `id` is absent from `latest.json`, scan the changelog for
   a `model_removed` event naming it → it's discontinued. Recommend a **replacement**
   (same `provider`, highest available version in `latest.json`), and cite the removal
   date. If it's merely absent but not in a removal event, flag it as "not found in
   tracker" — the user may be on a model the tracker doesn't list.
3. **Newer version of the same family.** Group `latest.json` models by `provider` and
   compare version tokens in `name` (e.g. GLM-5.2 → GLM-5.3). A strictly newer version
   present ⇒ candidate **UPDATE**. The strongest signal is a changelog pair
   `model_removed` (old) + `model_added` (new) of the same family — that *is* the
   successor. Don't recommend downgrades or cross-provider swaps unless the user asks.
4. **Price / usage drift.** Read the changelog for `price_changed` / `usage_changed`
   on the configured model. A `usage_changed` *increase* (e.g. `15→60`, `60→480`)
   lowers the effective price → good **KEEP** reason. A price increase → note it and
   check siblings for a cheaper alternative.
5. **Context vs preference.** Compare `contextWindow` to `minUsableContext`. If the
   configured model is below the threshold and a same-family alternative meets it,
   recommend the **UPDATE** with the context gap as the reason.
6. **Optional new candidates.** Separately, surface 1–3 models *not yet configured*
   that meet the preferences (cheap effective price, ≥ `minUsableContext`, recent
   `model_added`, or free) as "worth trying".

Cross-check CC when a family appears in both trackers; otherwise OCG is authoritative
for `opencode-go/*` IDs.

## Output format

Lead with a short summary (e.g. "2 updates, 2 keeps, 1 replacement needed"), then a
table:

```
| Configured model            | Role(s)        | Verdict  | Reason (from changelog / prices) |
|-----------------------------|----------------|----------|----------------------------------|
| opencode-go/hy3             | default, …     | KEEP     | usage 60→480 on 2026-08-19 → 8× cheaper effective; 256k ctx < 400k pref but unmatched price |
| opencode-go/glm-5.2         | general        | UPDATE → opencode-go/glm-5.3 | GLM-5.3 added 2026-08-14; 1M ctx meets 400k pref, 5.3-Flash even cheaper |
| opencode-go/<discontinued>  | build          | REPLACE  | model_removed 2026-08-25; successor opencode-go/<x> added same day |
```

Then a short "Optional new candidates" list. Keep reasons one line and always tie
them to a concrete changelog event or a current-price fact.

## Applying changes (only when the user asks)

If the user says "apply it" / "update my config", edit `~/.config/opencode/opencode.jsonc`:

- Update the `model` field (root `model` or `agent.<role>.model`) for each changed role.
- On **every changed `model` line**, add or refresh a trailing date comment — this is the
  recency signal the skill reads on future runs:
  `{ "model": "opencode-go/glm-5.3-flash"  // updated: 2026-08-28`
  Read any existing `// updated:` comments first; if a role's assignment is older than
  the latest relevant changelog entry, call that out as "stale".
- Keep the file valid JSONC: a trailing `,` is only allowed when another property follows
  in the same object — if `model` is the **last** property before `}`, do **not** add a
  comma. Only `//` comments; no block comments.
- Never touch `read`/`edit`/`shell` permission rules, `description` fields, or other
  settings — change only the `model` value + its `// updated:` comment.

## Preferences file schema (`~/.config/opencode/model-preferences.md`)

```markdown
# Model Preferences (global)

Used by the `model-updater` skill to recommend model updates.

- minUsableContext: 400000        # at least 400k usable context window
- preferFree: false               # prefer $0 models when quality is comparable
- maxEffectiveInputPerMTok: null  # optional hard cap on effective input $/1M tokens
- notes: "Prefer models with >= 400k context for long-agent runs and large diffs."
```

Edit this file (or ask the user to) to change the bar — the skill re-reads it every run.
