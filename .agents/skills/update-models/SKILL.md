---
name: Update Models
description: 'TRIGGER when the actual OpenCode model list is stale or a model is missing (e.g. a newly released free model never shows up), when asking for the models refresh/reload command, when distinguishing paid opencode-go/* vs free opencode/* model IDs — including which twin to pick when a model exists under both namespaces — or whenever a model ID is about to be written into opencode.jsonc (check twin + capability gate first); AND when the user wants to review or update their configured models ("which models should I update", "model recommendations", "check my models against the price trackers", "set all models to X", "alle Modelle auf X stellen") — the vision gate and the namespace rule apply to the user''s pick too. Cross-references the configured models with the live ocgo/cc price trackers (prices + changelog), recommends UPDATE vs KEEP, and fixes the namespace from `model-preferences.md`, never from the slug.'
---

# Update Models — live registry and UPDATE/KEEP advice

Two jobs under one skill, because they share the same traps:

1. **Live registry** — what `opencode models` reports at this moment. Use it when
   a model is missing/stale, when the refresh command is the question, or before
   writing any model ID into `opencode.jsonc`. Detail: `references/registry.md`.
2. **Model advisor** — compare the configured models against the live price
   trackers and emit **UPDATE / KEEP** recommendations, each reason citing the
   changelog or current prices. You only **recommend**: never edit
   `opencode.jsonc` unless the user explicitly asks you to apply the changes.
   Detail: `references/pricing.md`.

Why each rule exists (retired decisions, dated snapshots) lives in
`references/notes.md`; raw endpoints in `references/data-sources.md`.

## Registry and refresh (compressed)

```sh
opencode models                    # list all available models (via background service)
opencode models | grep -i free     # free models only
opencode reload                    # refresh cached config + model list ("Configuration reloaded")
opencode service restart           # heavier reset if reload is not enough
opencode service status            # verify daemon health afterwards
```

`opencode` is the real CLI binary, installed at `~/.opencode/bin/opencode` and on
`PATH` — call it as `opencode`. There is **no** `models refresh` subcommand —
`reload` is the refresh path. The list is served by the running background service
and can lag new releases: run `opencode reload`, then re-list; if still absent,
`opencode service restart` and check `opencode service status`. Provider-prefix
gotcha, stale-cache diagnosis and the namespace detail are in
`references/registry.md`.

## Hard requirements (not preferences — never trade these away)

**Vision on every configured model.** The root `model` and each
`agents.<role>.model` must have `"image"` in `capabilities.input`. **Never
recommend a model without image input** — not as UPDATE, replacement, candidate,
or cheap fallback. A text-only configured model is **REPLACE**, full stop;
price, context, and tier do not compensate. Ban list:
`curl -sL $RAW/data/latest.json | jq -r
'.models[] | select((.capabilities.input | index("image")) | not) | .id'`.
`capabilities` is an **object** — `.capabilities | index("image")` is always
`null`.

## Namespace rule — `model-preferences.md` decides, never the slug

**Read `namespaceRule` in `~/.config/opencode/model-preferences.md` first** — that
is the standing user decision and it outranks every default. The registry lists many
models under *both* namespaces, usually at identical price — verify in the tracker,
never infer from the slug.

- **Current standing rule (since 2026-10-18): `opencode-go-only`** — every configured
  model on `opencode-go/`: the root `model` plus per-role models for
  `plan`/`general`/`build`/`explore` (configured again 2026-10-18, same-day change).
  `opencode/` free twins are deliberately unused (`deepseek-v4.1-flash-free` is $0
  but only 200k ctx, below `minUsableContext`; `glm-5.3-flash-free` exists but is also only 200k ctx, below the bar). A
  configured `opencode-go/<slug>` is *not* a REPLACE on namespace grounds.
- **Retired 2026-10-18: the single-root phase** — briefly (same day) the config carried
  only the root `model` with no `agents.<role>.model`; per-role models are configured
  again. Also **retired: `opencode-go-mixed`** (2026-10-16..2026-10-18) — three
  models across the roles on `opencode-go/`. Do not revive either.
- A `-free` slug suffix says nothing about namespace, price, or privacy. A configured
  id only counts as a namespace **REPLACE** when the preferences file's rule says so —
  and never in the face of the vision gate above: **capability beats namespace.**

The rule history (ZDR `opencode-go-first` until 2026-09-26, free-tier-only 2026-10-02,
one-$0-family `opencode-go-free-single` 2026-10-08, the `step-5-preview-free` removal
2026-10-15) is retired: do not revive it, see `references/notes.md`.

### Tracker privacy flags are currently unusable

While `privacyDataCaveat` is set in the preferences, the tracker's `privacy` block is
**known-wrong**: never reject, downgrade, or REPLACE over a `training: true` flag. Only
`privacy.validUntil` may still drive a decision. Drop both once the data is fixed.

## Procedure (UPDATE / KEEP)

For every configured model (root `model` plus each `agents.<role>.model`): **0.
Capability gate first.** No `image` → **REPLACE** ("text-only"), propose it nowhere.
**0b. Namespace gate next.**
Apply the `model-preferences.md` rule (above); hard capability needs override.
**0c. Privacy gate.** Caveat set → ignore `privacy.training` / `privacy.retentionDays`.
**1. Locate.** Match `id` (not `name`) in `latest.json` (`models` + `freeModels`).
**2. Availability.** Absent + `model_removed` naming it → discontinued: **REPLACE**
(same `provider`, highest available version, cite removal date); absent without one →
"not found in tracker". **3. Newer same-family version.** Group by `provider`, compare
version tokens; strictly newer ⇒ **UPDATE** (strongest signal: a `model_removed` +
`model_added` pair). No downgrades or cross-provider swaps unless asked. **4.
Price/usage drift.** `usage_changed` increase → good **KEEP** reason; price increase →
note it, check siblings. **5. Context.** Below `minUsableContext` with a same-family
alternative meeting it → **UPDATE**. **6. New candidates.** Surface 1–3 unconfigured,
preference-meeting models as "worth trying" — all gates apply. Cross-check CC for
shared families. Inputs (config + `jq` recipe, preferences schema) and the full
procedure: `references/pricing.md`; endpoints: `references/data-sources.md`.

## Output format

Summary first (e.g. "KEEP" or "REPLACE needed"), then one row per configured model
(root `model` as role `default`; `plan`, `general`, `build`, `explore` when
configured):

```
| Configured model         | Role    | Verdict  | Reason (from changelog / prices) |
|--------------------------|---------|----------|----------------------------------|
| opencode-go/<current>    | default | KEEP     | caps [text,image]; cheapest vision-capable, ctx meets pref |
| opencode-go/<current>    | plan    | KEEP     | caps [text,image]; per-role model matches the namespace rule |
| opencode-go/<text-only>  | build   | REPLACE  | input [text] → violates vision requirement, price irrelevant |
| opencode-go/<oldver>     | general | UPDATE → opencode-go/<newver> | <Family>-<newver> added 2026-08-14; meets ctx pref |
```

Then "Optional new candidates" — vision-capable only, one line each, every reason tied
to a changelog event or current-price fact.

## Reasoning variants — DISABLED by user decision (2026-10-02)

`variants: none`. **Do not propose, keep, or re-add any `variant` field**; a configured
one is a REPLACE by deletion. `variant` is its own `AgentConfig` field, never a `#max`
suffix; not every model has variants — check the `models` tool (`query` + `all: true`).
History in `references/notes.md`.

## Applying changes (only when the user asks)

Update the root `model` and/or the matching `agents.<role>.model` line(s) the user
named; per-role models are configured again for `plan`/`general`/`build`/`explore`,
so do not assume the root is the only model line. Never add `variant`, remove one if
present; namespace rule on every touched line. Refresh the trailing
`// updated: <date>` comment on a changed line; call out an assignment older than the
latest relevant changelog entry as stale. Keep JSONC valid (trailing `,` only before
another property; `//` comments only) and touch nothing but `model` + comment — except
a `description` now wrong about the *namespace*; never write "training: true" into one
while the caveat stands. **Restart the background service afterwards**
(`opencode service restart`), then `opencode service status`.
