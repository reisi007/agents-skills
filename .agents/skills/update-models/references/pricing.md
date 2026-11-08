# Pricing — trackers, procedure, preferences

Detail for the advisor half of the `update-models` skill: the price-tracker data sources,
the full UPDATE/KEEP procedure, and the preferences-file schema. Obligations live in
`SKILL.md`; raw endpoints and `jq` snippets in `data-sources.md`.

## Data sources (read these, do NOT scrape the website)

Both trackers publish small, structured JSON — fetch the raw files (exact URLs + `jq`
snippets in `data-sources.md`), never the rendered HTML site. **OCG** is authoritative
for `opencode-go/<slug>` and `opencode/<slug>` IDs, which covers the configured models:
`data/latest.json` is the snapshot (`models[]`, `freeModels[]`), `CHANGELOG.json` the
typed events (`model_added`, `model_removed`, `price_changed`, `usage_changed`,
`capabilities_changed`, `free_added/removed`, `text`) behind almost every reason. **CC**
is supplementary (`provider/model` namespace): corroborate shared families, surface
CC-only alternatives. Pull the **last ~15–30 changelog entries**.

## Inputs

1. **Configured models** — the root `model` plus each `agents.<role>.model`
   (`plan`/`general`/`build`/`explore`) from `~/.config/opencode/opencode.jsonc`
   (`jq`/JSONC recipe in `data-sources.md`). Read
   each `model` line's trailing `// updated: <date>` comment (staleness vs. changelog)
   and its `variant` — a configured entry is `(model, variant)`, not `model` alone.
2. **Preferences** — `~/.config/opencode/model-preferences.md`; if missing, **create it**
   from the schema below and say so. `minUsableContext` (default `400000`), `preferFree`
   (default `false`), `maxEffectiveInputPerMTok` (default `null`; the cap is on the
   **paid** basis — what the subscription actually charges — and never on the
   credit-value `full` basis), `notes`,
   `namespaceRule` (current standing rule `opencode-go-only` since 2026-10-18; the
   earlier `opencode-go-mixed` and `opencode-free-tier` are retired — history in
    `notes.md`. Filter *before* scoring, never justify with ZDR), `variants` (variants
    are allowed; only recommend/configure variants supported by the selected model), `privacyDataCaveat`
   (when set, ignore `privacy.training` / `privacy.retentionDays`). `namespaceRule` is
   the standing decision and wins over any default in the namespace rule in `SKILL.md`;
   read it before scoring. Per-role models are configured again (2026-10-18), so score
   the root `model` and every configured role separately.

## Procedure (full)

For every configured model (root `model` plus each `agents.<role>.model`): **0. Capability gate first.** No `image` → **REPLACE**
("text-only"), propose it nowhere. **0b. Namespace gate next.** Apply the
`namespaceRule` in `~/.config/opencode/model-preferences.md` — that file is the
arbiter, not the slug; with the current rule (`opencode-go-only`) a configured
`opencode-go/<slug>` is **not** a REPLACE on namespace grounds, even where the
registry carries an `opencode/` twin. The twin only justifies a REPLACE while
`namespaceRule` still carries the free-tier namespace rule. Hard capability needs
override; filter candidates the same way. **0c. Privacy gate.** Caveat set → ignore
`privacy.training` / `privacy.retentionDays`. **1. Locate.** Match `id` (not `name`) in
`latest.json` (`models` + `freeModels`). **2. Availability.** Absent + `model_removed`
naming it → discontinued: **REPLACE** (same `provider`, highest available version, cite
removal date); absent without one → "not found in tracker". **3. Newer same-family
version.** Group by `provider`, compare version tokens; strictly newer ⇒ **UPDATE**
(strongest signal: a `model_removed` + `model_added` pair). No downgrades or
cross-provider swaps unless asked. **4. Price/usage drift.** `usage` is the monthly
**dollar allowance for that model** inside the plan (`usage.go`, `usage["go-plus"]`;
`null` = unlimited) — **higher `usage` = lower effective price**. The math lives in the
tracker, `ocgo-price-tracker/src/weighted.ts`: `multiplier = creditsMonthly / usage`
(basis `full`), `priceMonthly / usage` (basis `paid`), `requestsPerMonth = usage /
requestCost(list)`. `maxEffectiveInputPerMTok` uses the **paid** basis: it caps the
money the subscription actually charges per MTok (`list × priceMonthly / usage`),
not the credit-value `full` basis (`list × creditsMonthly / usage`). A
`usage_changed` increase is a good **KEEP** reason **for that plan**: the event's
`plans[]` is plan-scoped, so read the entry for the plan in use (`go`, `go-plus`,
…) and quote only its `from`/`to`; a Go-Plus-only change is not a Go improvement.
Never read `usage` as consumption or "credits burned".

**Tiered prices.** A model ID can have multiple rows distinguished by `tier`
(for example, Peak and Off-Peak); do not deduplicate them, drop the tier, or select
an arbitrary/cheapest row. Keep the tier attached to every quoted rate. When the
workload time is known, map that same time through each model's own tracker
`peakRules` and use the applicable row for all price comparisons; schedules can
differ between models. If the relevant tier is known directly, use that matching
row. A single-row model uses its sole rate; if a multi-row model's tier cannot be
mapped, treat it as unknown. Apply `maxEffectiveInputPerMTok` to the applicable row's
**paid** effective input, never to `full`. For output, cache, or request-cost
comparisons, use that same applicable row and calculate the corresponding metric; do
not infer it from the input rate.

When workload time/tier is unknown, calculate each listed tier's paid effective
input and use the **highest** as the conservative worst-case value for both model
price comparisons and the paid-input cap. Apply the same rule per model (a
single-tier model uses its sole row), report the tier and label the value as a
worst-case scenario—not the actual price for an unknown workload. Do not average
tiers or assume the row named `Peak` is always the most expensive; use the computed
maximum. For any other comparison metric, use that metric's own highest computed
tier value; do not reuse the input maximum. Compare paid values with paid values;
show `full` only as separately labeled credit-value context. If the selected plan's
`usage` is `null` (unlimited), the paid effective rate is not numeric: report it as
unavailable/unlimited, not `$0` or an automatic cap pass.

In every case, compare **effective** prices, not list prices — a subscription buys
the allowance, not the list rate. Price increase → note it, check siblings. **5.
Context.** Below
`minUsableContext` with a same-family alternative meeting it → **UPDATE**. **6. New
candidates.** Surface 1–3 unconfigured, preference-meeting models as "worth trying" —
all gates apply. Cross-check CC for shared families.

## Preferences file schema (`~/.config/opencode/model-preferences.md`)

```markdown
# Model Preferences (global)

Used by the `update-models` skill to recommend model updates.

- minUsableContext: 400000        # at least 400k usable context window
- preferFree: false               # prefer $0 models when quality is comparable
- maxEffectiveInputPerMTok: null  # optional hard cap on effective input $/1M tokens,
  # paid basis (list × priceMonthly / usage); null = no cap
- notes: "Prefer models with >= 400k context for long-agent runs and large diffs."
```
