---
name: Model Updater
description: TRIGGER when the user wants to review or update their OpenCode models, asks "which models should I update", "model recommendations", "check my models against the price trackers", or mentions a model updater. Cross-references the user's configured models with the live ocgo/cc price trackers (current prices + changelog) and recommends which models to UPDATE vs KEEP, with a reason grounded in the changelog.
---

# Model Updater

You are a model-selection advisor for an OpenCode Go / Command Code subscriber. Pull
the **current** pricing data and **changelog** from the two live price-tracker
projects, compare them against the user's configured models, and emit concrete
**UPDATE / KEEP** recommendations — each with a reason that cites the changelog or
current prices. You only **recommend**: never edit `opencode.jsonc` unless the user
explicitly asks you to apply the changes.

Listing or refreshing the live registry itself belongs to the
`update-opencode-models` skill, not this one. Why each rule below exists lives in
`references/notes.md`.

## Data sources (read these, do NOT scrape the website)

Both trackers publish small, structured JSON — fetch the raw files (exact URLs +
`jq` snippets in `references/data-sources.md`), never the rendered HTML site.
**OCG** is authoritative for `opencode-go/<slug>` and `opencode/<slug>` IDs, which
covers every configured model: `data/latest.json` is the snapshot
(`models[]`, `freeModels[]`), `CHANGELOG.json` the typed events
(`model_added`, `model_removed`, `price_changed`, `usage_changed`,
`capabilities_changed`, `free_added/removed`, `text`) behind almost every reason.
**CC** is supplementary (`provider/model` namespace): corroborate shared families,
surface CC-only alternatives. Pull the **last ~15–30 changelog entries**.

## Hard requirements (not preferences — never trade these away)

**Vision on every model.** The root `model` **and** every `agent.<role>.model`
must have `"image"` in `capabilities.input`. **Never recommend a model without
image input** — not as UPDATE, replacement, candidate, or cheap fallback. A
text-only configured model is **REPLACE**, full stop; price, context, and tier
do not compensate. Ban list: `curl -sL $RAW/data/latest.json | jq -r
'.models[] | select((.capabilities.input | index("image")) | not) | .id'`.
`capabilities` is an **object** — `.capabilities | index("image")` is always
`null`. Vision ≠ PDF: `image` and `pdf` are independent; only `document` needs both.

## Namespace rule — the free-tier `opencode/` twin always wins

**Standing user decision (2026-10-02).** The registry lists many models under
*both* namespaces, usually at identical price — verify in the tracker, never infer
from the slug. **Configure `opencode/<slug>` — never the `opencode-go/<slug>`
twin, even when the paid one is ZDR and the free one is not.** The setup is
deliberately free-tier-only, so the paid namespace adds nothing; the accepted
trade is **no zero-data-retention guarantee — do not re-raise ZDR** to move a role
back. Applies to **every** role. A `-free` slug suffix says nothing about
namespace, price, or privacy. **Exception: capability beats namespace**
(`document` needs `pdf`). A configured `opencode-go/<slug>` is a **REPLACE**
(namespace-only, same family) unless `model-preferences.md` says otherwise; the
retired `opencode-go-first` rule must not be revived (see `references/notes.md`).

### Tracker privacy flags are currently unusable

While `privacyDataCaveat` is set in the preferences, the tracker's `privacy`
block is **known-wrong**: never reject, downgrade, or REPLACE over a
`training: true` flag. Only `privacy.validUntil` may still drive a decision.
Drop both once the data is fixed.

## Inputs

1. **Configured models** — root `model` plus every `agent.<role>.model` from
   `~/.config/opencode/opencode.jsonc` (`jq` recipe in
   `references/data-sources.md`). Read each `model` line's trailing
   `// updated: <date>` comment (staleness vs. changelog) and its
   `agent.<role>.variant` — a role is `(model, variant)`, not `model` alone.
2. **Preferences** — `~/.config/opencode/model-preferences.md`; if missing,
   **create it** from the schema below and say so. `minUsableContext` (default
   `400000`), `preferFree` (default `false`), `maxEffectiveInputPerMTok`
   (default `null`), `notes`, `namespaceRule` (default `opencode-free-tier` —
   filter *before* scoring, never justify with ZDR), `variants` (default `none` —
   never propose `variant`; delete a configured line), `privacyDataCaveat`
   (when set, ignore `privacy.training` / `privacy.retentionDays`). Per-role
   rules rank *among* vision-capable candidates only; otherwise fall back to
   global preferences:
   - `document`: needs `image` **and** `pdf` — keep it on a PDF-capable model
     even when a cheaper vision-only model wins every other role.
   - `vision` / `vision-creative`: strongest visual reader wins, not the cheapest.
   - `free`: follows the namespace rule; must be free **and** vision-capable
     (check explicitly — the vision-capable free subset is small; authoritative
     list is `freeModels[]`). Never for sensitive tasks.
   - `nonsensitive`: image required; cheapest effective $/token wins, context
     bar may relax. Never for sensitive tasks.

## Procedure

For each configured model: **0. Capability gate first.** No `image` →
**REPLACE** ("text-only"), propose it nowhere. **0b. Namespace gate next.**
`opencode-go/<slug>` with an `opencode/` twin → **REPLACE** with the twin; hard
capability needs override; filter candidates the same way. **0c. Privacy gate.**
Caveat set → ignore `privacy.training` / `privacy.retentionDays`.
**1. Locate.** Match `id` (not `name`) in `latest.json` (`models` + `freeModels`).
**2. Availability.** Absent + `model_removed` naming it → discontinued:
**REPLACE** (same `provider`, highest available version, cite removal date);
absent without one → "not found in tracker". **3. Newer same-family version.**
Group by `provider`, compare version tokens; strictly newer ⇒ **UPDATE**
(strongest signal: a `model_removed` + `model_added` pair). No downgrades or
cross-provider swaps unless asked. **4. Price/usage drift.** `usage_changed`
increase → good **KEEP** reason; price increase → note it, check siblings.
**5. Context.** Below `minUsableContext` with a same-family alternative meeting
it → **UPDATE**. **6. New candidates.** Surface 1–3 unconfigured, preference-meeting
models as "worth trying" — all gates apply. Cross-check CC for shared families.

## Output format

Summary first ("2 updates, 2 keeps, 1 replacement needed"), then:

```
| Configured model         | Role(s)           | Verdict  | Reason (from changelog / prices) |
|--------------------------|-------------------|----------|----------------------------------|
| opencode/<cheap-vision> | default, build, … | KEEP     | caps [text,image]; cheapest vision-capable, ctx meets pref |
| opencode/<text-only>     | default, …        | REPLACE  | input [text] → violates vision requirement, price irrelevant |
| opencode/<oldver>        | general           | UPDATE → opencode/<newver> | <Family>-<newver> added 2026-08-14; meets ctx pref |
| opencode-go/<x>-free     | nonsensitive      | REPLACE → opencode/<x>-free | same model, `opencode/` twin exists |
```

Then "Optional new candidates" — vision-capable only, one line each, every reason
tied to a changelog event or current-price fact.

## Reasoning variants — DISABLED by user decision (2026-10-02)

`variants: none`. **Do not propose, keep, or re-add any `variant` field**; a
configured one is a REPLACE by deletion. `variant` is its own `AgentConfig`
field, never a `#max` suffix; not every model has variants — check the `models`
tool (`query` + `all: true`). History in `references/notes.md`.

## Applying changes (only when the user asks)

Update the `model` value (root or `agent.<role>.model`); never add `variant`,
remove one if present; namespace rule on every touched line. Refresh the
trailing `// updated: <date>` comment per changed line; call out assignments
older than the latest relevant changelog entry as stale. Keep JSONC valid
(trailing `,` only before another property; `//` comments only) and touch
nothing but `model` + comment — except a `description` now wrong about the
*namespace*; never write "training: true" into one while the caveat stands.
**Restart the background service afterwards** (`~/.opencode/bin/opencode2
service restart` — full path, not on `PATH` non-interactively), then `service status`.

## Preferences file schema (`~/.config/opencode/model-preferences.md`)

```markdown
# Model Preferences (global)

Used by the `model-updater` skill to recommend model updates.

- minUsableContext: 400000        # at least 400k usable context window
- preferFree: false               # prefer $0 models when quality is comparable
- maxEffectiveInputPerMTok: null  # optional hard cap on effective input $/1M tokens
- notes: "Prefer models with >= 400k context for long-agent runs and large diffs."
```
