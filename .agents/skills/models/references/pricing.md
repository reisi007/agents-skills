# Pricing — trackers, procedure, preferences

Detail for the advisor half of the `models` skill: the price-tracker data sources,
the full UPDATE/KEEP procedure, and the preferences-file schema. Obligations live in
`SKILL.md`; raw endpoints and `jq` snippets in `data-sources.md`.

## Data sources (read these, do NOT scrape the website)

Both trackers publish small, structured JSON — fetch the raw files (exact URLs + `jq`
snippets in `data-sources.md`), never the rendered HTML site. **OCG** is authoritative
for `opencode-go/<slug>` and `opencode/<slug>` IDs, which covers every configured model:
`data/latest.json` is the snapshot (`models[]`, `freeModels[]`), `CHANGELOG.json` the
typed events (`model_added`, `model_removed`, `price_changed`, `usage_changed`,
`capabilities_changed`, `free_added/removed`, `text`) behind almost every reason. **CC**
is supplementary (`provider/model` namespace): corroborate shared families, surface
CC-only alternatives. Pull the **last ~15–30 changelog entries**.

## Inputs

1. **Configured models** — root `model` plus every `agent.<role>.model` from
   `~/.config/opencode/opencode.jsonc` (`jq`/JSONC recipe in `data-sources.md`). Read
   each `model` line's trailing `// updated: <date>` comment (staleness vs. changelog)
   and its `agent.<role>.variant` — a role is `(model, variant)`, not `model` alone.
2. **Preferences** — `~/.config/opencode/model-preferences.md`; if missing, **create it**
   from the schema below and say so. `minUsableContext` (default `400000`), `preferFree`
   (default `false`), `maxEffectiveInputPerMTok` (default `null`), `notes`,
   `namespaceRule` (default `opencode-free-tier` — filter *before* scoring, never justify
   with ZDR), `variants` (default `none` — never propose `variant`; delete a configured
   line), `privacyDataCaveat` (when set, ignore `privacy.training` /
   `privacy.retentionDays`). `namespaceRule` is the standing decision and wins over any
   default in the namespace rule in `SKILL.md`; read it before scoring. Per-role rules
   rank *among* vision-capable candidates only; otherwise fall back to global
   preferences:
   - `vision` / `vision-creative`: strongest visual reader wins, not the cheapest.
   - `free`: follows the namespace rule; must be free **and** vision-capable (check
     explicitly — the vision-capable free subset is small; authoritative list is
     `freeModels[]`). Never for sensitive tasks.
   - `nonsensitive`: image required; cheapest effective $/token wins, context bar may
     relax. Never for sensitive tasks.

## Procedure (full)

For each configured model: **0. Capability gate first.** No `image` → **REPLACE**
("text-only"), propose it nowhere. **0b. Namespace gate next.** `opencode-go/<slug>`
with an `opencode/` twin → **REPLACE** with the twin; hard capability needs override;
filter candidates the same way. **0c. Privacy gate.** Caveat set → ignore
`privacy.training` / `privacy.retentionDays`. **1. Locate.** Match `id` (not `name`) in
`latest.json` (`models` + `freeModels`). **2. Availability.** Absent + `model_removed`
naming it → discontinued: **REPLACE** (same `provider`, highest available version, cite
removal date); absent without one → "not found in tracker". **3. Newer same-family
version.** Group by `provider`, compare version tokens; strictly newer ⇒ **UPDATE**
(strongest signal: a `model_removed` + `model_added` pair). No downgrades or
cross-provider swaps unless asked. **4. Price/usage drift.** `usage_changed` increase →
good **KEEP** reason; price increase → note it, check siblings. **5. Context.** Below
`minUsableContext` with a same-family alternative meeting it → **UPDATE**. **6. New
candidates.** Surface 1–3 unconfigured, preference-meeting models as "worth trying" —
all gates apply. Cross-check CC for shared families.

## Preferences file schema (`~/.config/opencode/model-preferences.md`)

```markdown
# Model Preferences (global)

Used by the `models` skill to recommend model updates.

- minUsableContext: 400000        # at least 400k usable context window
- preferFree: false               # prefer $0 models when quality is comparable
- maxEffectiveInputPerMTok: null  # optional hard cap on effective input $/1M tokens
- notes: "Prefer models with >= 400k context for long-agent runs and large diffs."
```
