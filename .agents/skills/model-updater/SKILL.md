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
  but often lists the *same model families* (a CC kebab-case slug ↔ the OCG display
  name of that family). Use it to corroborate pricing/context of a family and to
  surface CC-only alternatives. Same `data/latest.json` + `CHANGELOG.json` shape.

Each changelog entry carries an `id` (run timestamp) and `date`; an entry can have
several `changes`. Pull the **last ~15–30 entries** — that's the relevant change
window.

## Hard requirements (not preferences — never trade these away)

Every model this skill touches — the root `model` **and** every
`agent.<role>.model` — must be **vision-capable**: `"image"` in
`capabilities.input`. The whole agent setup assumes it: the main model reads
screenshots, EXIF-relevant details and image categories itself, and the
`vision-agents` skill has no technical shim subagent because of it.

**Never recommend a model without image input.** Not as an UPDATE, not as a
replacement, not in "Optional new candidates", not as a cheap fallback. If a
configured model is text-only, the verdict is **REPLACE** — price, context
window and reasoning tier are irrelevant, they do not compensate.

```sh
# text-only models in the current snapshot — the ban list
curl -sL $RAW/data/latest.json | jq -r '.models[] | select((.capabilities.input | index("image")) | not) | .id'
```

Two traps:

- `capabilities` is an **object** (`{input: [...], output: [...], reasoning, toolCall}`).
  `.capabilities | index("image")` is always `null` — check `.capabilities.input`.
- **Vision ≠ PDF.** `image` and `pdf` are independent entries in `capabilities.input`.
  The `document` role needs `pdf` as well; a vision-capable model that cannot read
  PDFs is fine everywhere else.

## Namespace hard rule — the `opencode-go/` twin always wins

The user's **opencode-go subscription is ZDR** (zero data retention). The registry
lists many models under *both* namespaces (`opencode-go/<slug>` and
`opencode/<slug>`), often at identical price (usually both `$0`). Rule:

> **If a model exists in both namespaces, always configure the `opencode-go/<slug>`
> variant — never `opencode/<slug>`, even when the `opencode/` twin is also free.**

- This applies to **every** role — root, build, plan, and the cheap background
  roles included. It is not a free-tier-only rule.
- The **`opencode/` namespace is the free tier for users without a subscription**
  and is not used in this setup at all.
- **The reason is ZDR, not rename durability.** Say so when justifying the change:
  a model on `opencode/<slug>` does not get the subscription's zero-data-retention
  guarantee, even at the same $0 price. "It survives a free-tier rename" is a much
  weaker argument and is not the user's reason.
- A slug ending in `-free` says nothing about namespace, price, or privacy — never
  infer any of the three from the slug; check the registry.
- A configured `opencode/<slug>` that has an `opencode-go/<slug>` twin is a
  **REPLACE** (namespace-only change, same model family) unless a standing user
  decision in `model-preferences.md` says otherwise for that role.

### Privacy flags in the tracker are currently wrong

As of **2026-09-26** the tracker's `privacy` block (`privacy.training`,
`privacy.retentionDays`) is **known to be inaccurate**: models are displayed as
non-ZDR and the data is being corrected. Therefore:

- **Never reject, downgrade, or "REPLACE" a model over a `training: true` flag**
  until that correction has landed. A `training:true` flag is not a usable
  reason to move a role, and not a usable reason to surface a candidate.
- The only privacy signal that may still drive a decision is `privacy.validUntil`
  (used for promo/expiry dates), and even that should be double-checked.
- `model-preferences.md` carries a matching `privacyDataCaveat: 2026-09-26` entry.
  Drop both once the data is fixed.

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
   - **`namespaceRule`** (default `opencode-go-first`) — the namespace hard rule above.
     Honour it as a filter, *before* scoring: drop every `opencode/<slug>` candidate
     that has an `opencode-go/<slug>` twin, and flag a configured one as REPLACE
     (namespace-only change, same model family). Justify with ZDR, not rename durability.
   - **`privacyDataCaveat`** — when set, the tracker's `privacy.training` /
     `privacy.retentionDays` flags are known-wrong; do not use them to reject a model.
   - **Per-role preferences** (under `## Per-role preferences`): apply them when
     scoring that specific role. The hard requirement above already applies to
     every role — these rules only rank *among* the vision-capable candidates.
     Current standing rules:
     - `document`: needs `image` **and** `pdf` in `capabilities.input`. Keep this
       role on a PDF-capable model even when a cheaper vision-only model wins
       every other role.
     - `vision` / `vision-creative`: image (and video) input matters most; among
       vision-capable models pick the strongest visual reader, not the cheapest.
     - `free` (the cheap fan-out role; **namespace follows the namespace hard rule**,
       so `opencode-go/<slug>`; the *model* is still a $0 one — the role is about cost,
       not about namespace): **do NOT use for sensitive tasks** (private data, secrets,
       credentials). Must be free **and** vision-capable — the free tier's
       vision-capable subset is small, so check `capabilities.input` explicitly instead
       of assuming. Authoritative free list is `freeModels[]`; do not treat a `-free`
       slug suffix as the signal, some free ids carry no suffix. Then prefer higher
       capabilities / cheaper price. Use for cheap fan-out, pre-checks, and
       non-critical subtasks.
     - `nonsensitive` (namespace follows the namespace hard rule, so `opencode-go/<slug>`):
       **do NOT use
       for sensitive tasks** involving private data, secrets, credentials,
       or personal information — route those to a trusted model instead. Image input
       is required; prioritize lowest effective $/token over quality, context
       requirement may be relaxed. Ideal for non-sensitive, non-critical fan-out,
       pre-checks, boilerplate, and summaries.
   If a role has no explicit rule, fall back to the global preferences.

## Procedure

For each configured model (e.g. `opencode-go/<configured-id>`):

0. **Capability gate — first, before any scoring.** Read `.capabilities.input` for
   the model. No `image` → verdict is **REPLACE**, full stop, reason "text-only, no
   image input". Do not weigh price, context window or tier for such a model, and
   never propose it anywhere — not as an UPDATE, not as a successor, not as a cheap
   fallback, not in "Optional new candidates".
0b. **Namespace gate — every role, right after the capability gate.** If the
    configured `opencode/<slug>` has an `opencode-go/<slug>` twin in the registry
    (`opencode2 models` lists both), the verdict is **REPLACE** with the
    `opencode-go/` twin: same model family, usually identical price, but it carries
    the subscription's ZDR guarantee. This holds for the root model and the cheap
    background roles too, not just `free` — a slug ending in `-free` never makes an
    `opencode/` ID the right one. `opencode/` is the no-subscription free tier and is
    not used here. The same filter applies to every candidate you propose, not just
    to what is already configured.
0c. **Privacy-flag gate.** If `privacyDataCaveat` is set in the preferences, the
    tracker's `privacy.training` / `privacy.retentionDays` values are known-wrong —
    do not REPLACE, downgrade, or reject anything over a `training: true` flag.
1. **Locate it.** Find the matching `id` in OCG `latest.json` (`models` + `freeModels`).
   Tier rows share one `id` (e.g. `opencode-go/<family>` can cover both tiers), so
   match on `id`, not `name`.
2. **Availability.** If the `id` is absent from `latest.json`, scan the changelog for
   a `model_removed` event naming it → it's discontinued. Recommend a **replacement**
   (same `provider`, highest available version in `latest.json`), and cite the removal
   date. If it's merely absent but not in a removal event, flag it as "not found in
   tracker" — the user may be on a model the tracker doesn't list.
3. **Newer version of the same family.** Group `latest.json` models by `provider` and
   compare version tokens in `name` (e.g. `<Family>-<oldver>` → `<Family>-<newver>`).
   A strictly newer version present ⇒ candidate **UPDATE**. The strongest signal is a
   changelog pair `model_removed` (old) + `model_added` (new) of the same family — that
   *is* the successor. Don't recommend downgrades or cross-provider swaps unless the
   user asks.
4. **Price / usage drift.** Read the changelog for `price_changed` / `usage_changed`
   on the configured model. A `usage_changed` *increase* (e.g. `15→60`, `60→480`)
   lowers the effective price → good **KEEP** reason. A price increase → note it and
   check siblings for a cheaper alternative.
5. **Context vs preference.** Compare `contextWindow` to `minUsableContext`. If the
   configured model is below the threshold and a same-family alternative meets it,
   recommend the **UPDATE** with the context gap as the reason.
6. **Optional new candidates.** Separately, surface 1–3 models *not yet configured*
   that meet the preferences (cheap effective price, ≥ `minUsableContext`, recent
   `model_added`, or free) as "worth trying". All hard rules apply here too —
   only surface candidates with `image` in `capabilities.input`, never propose an
   `opencode/<slug>` when an `opencode-go/<slug>` twin exists, and never reject one
   over a `training:true` flag while `privacyDataCaveat` is set. A text-only model
   is never "worth trying", no matter how cheap it is.

Cross-check CC when a family appears in both trackers; otherwise OCG is authoritative
for `opencode-go/*` IDs.

## Output format

Lead with a short summary (e.g. "2 updates, 2 keeps, 1 replacement needed"), then a
table:

```
| Configured model              | Role(s)           | Verdict  | Reason (from changelog / prices) |
|-------------------------------|-------------------|----------|----------------------------------|
| opencode-go/<cheap-vision>   | default, build, … | KEEP     | caps input [text,image]; cheapest vision-capable option, ctx meets pref |
| opencode-go/<text-only>       | default, …        | REPLACE  | `capabilities.input: [text]` → violates the vision requirement, price irrelevant |
| opencode-go/<oldver>          | general           | UPDATE → opencode-go/<newver> | <Family>-<newver> added 2026-08-14; meets ctx pref, flash variant cheaper |
| opencode-go/<discontinued>    | build             | REPLACE  | model_removed 2026-08-25; successor opencode-go/<x> added same day |
| opencode/<x>-free             | nonsensitive      | REPLACE → opencode-go/<x>-free | same model, `opencode-go/` twin exists — carries the ZDR guarantee, price identical |
```

Then a short "Optional new candidates" list — vision-capable only. Keep reasons one
line and always tie them to a concrete changelog event or a current-price fact.

## Applying changes (only when the user asks)

If the user says "apply it" / "update my config", edit `~/.config/opencode/opencode.jsonc`:

- Update the `model` field (root `model` or `agent.<role>.model`) for each changed role.
- Apply the namespace hard rule on every line you touch: if the `opencode-go/<slug>`
  twin exists, the ID you write must be the `opencode-go/` one.
- On **every changed `model` line**, add or refresh a trailing date comment — this is the
  recency signal the skill reads on future runs:
  `{ "model": "opencode-go/<new-id>"  // updated: 2026-08-28`
  Read any existing `// updated:` comments first; if a role's assignment is older than
  the latest relevant changelog entry, call that out as "stale".
- Keep the file valid JSONC: a trailing `,` is only allowed when another property follows
  in the same object — if `model` is the **last** property before `}`, do **not** add a
  comma. Only `//` comments; no block comments.
- Never touch `read`/`edit`/`shell` permission rules, `description` fields, or other
  settings — change only the `model` value + its `// updated:` comment. The one
  exception: if a model change makes a `description` factually wrong about the
  *namespace* (e.g. a role described as `opencode, training: true` that now sits
  on `opencode-go/<slug>`), correct that. Leaving it stale is worse than
  touching it. Do not, however, write "training: true" into a description as a
  fact while `privacyDataCaveat` is set — that data is known-wrong.
- **After every applied change, restart the background service** so the running daemon
  picks up the new models (the daemon caches the resolved config):
  ```
  ~/.opencode/bin/opencode2 service restart
  ```
  (Use the full path — `opencode2` is not on `PATH` in non-interactive shells. If a
  future machine's binary is called `opencode` instead, use `opencode service restart`
  equivalently.) Then verify with `~/.opencode/bin/opencode2 service status`.

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
