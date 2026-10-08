---
name: Update OpenCode Models
description: TRIGGER when the actual OpenCode model list is stale or a model is missing (e.g. a newly released free model never shows up), when asking for the opencode models refresh/reload command, when distinguishing paid opencode-go/* vs free opencode/* model IDs — including which twin to pick when a model exists under both namespaces — or whenever a model ID is about to be written into opencode.jsonc (check for a twin and the capability gate first). Namespace default since 2026-10-08: one $0 model family on `opencode-go/` (`opencode-go/step-5-preview-free`), whose `opencode/` twin is deliberately unused — follow `model-preferences.md`, never infer from the slug. Reference for listing, refreshing, and diagnosing the live OpenCode model registry.
---

# Update OpenCode Models — live registry, not config advice

This skill is about the **actual OpenCode model list** (what `opencode models`
reports). For UPDATE/KEEP recommendations on the models pinned in
`opencode.jsonc`, use the `model-updater` skill instead.

## Commands

```sh
opencode2 models                    # list all available models (via background service)
opencode2 models | grep -i free     # free models only
opencode2 reload                    # refresh cached config + model list ("Configuration reloaded")
opencode2 service restart           # heavier reset if reload is not enough
opencode2 service status            # verify daemon health afterwards
```

There is **no** dedicated `models refresh` subcommand — `reload` is the refresh
path. (`opencode2` is at `/usr/local/bin`; not `~/.opencode/bin`.)

## Provider prefix gotcha

- Paid models → `opencode-go/<slug>` (e.g. `opencode-go/<family>-<ver>-flash`).
- Free models → `<slug>-free` under **both** prefixes (e.g.
  `opencode/<family>-<ver>-flash-free` *and* `opencode-go/<family>-<ver>-flash-free`).

A "missing" model is often a prefix mistake — but note which direction. Older free
models appeared only under `opencode/`, so searching `opencode-go/<slug>-free` found
nothing. That is no longer true: free models (snapshot 2026-10-02:
`space-bunny-free`,
`longcat-2.5-preview-free`, `muse-spark-1.3-contributor-free` — re-check with
`opencode2 models | grep -i free`) are listed under
**both** prefixes. Never conclude "no such model" from one prefix alone — grep the
family name and look at every row that comes back.

## Which namespace belongs on which role

**Rule: follow `~/.config/opencode/model-preferences.md` — never the slug, and
never a stale snapshot of this file.** Current standing decision (2026-10-08):
**every role runs on `opencode-go/step-5-preview-free`**, a single `$0` model
family (it is listed in the tracker's `freeModels[]`). Its `opencode/` twin
exists at the same price and is **deliberately unused** — do not "fix" the
configured `opencode-go/<slug>` into `opencode/<slug>`.

- The **`opencode/`** provider namespace is the free tier → use it whenever it
  exists **and** the preferences say so.
- The **`opencode-go/`** namespace is the subscription one → normally only when
  a hard capability need forces it; since 2026-10-08 it is also the home of the
  single free model the whole setup uses, so the namespace alone says nothing
  about price. Check the registry, not the prefix.

Price is frequently identical (`effectiveInput: 0` either way). The reason for
the current single-family setup is the user decision of 2026-10-08, **not** ZDR
and not rename durability. A slug
ending in `-free` says nothing about namespace, price, or privacy; check the registry
instead of inferring.

**History:** "always the `opencode-go/<slug>` twin because the subscription is
ZDR" (until 2026-10-02) and "always the `opencode/<slug>` twin because the setup
is free-tier-only" (2026-10-02 until 2026-10-08) are both retired. Do not revive
either, and do not treat a configured id in either namespace as a mistake to
correct — the preferences file is the arbiter.

Configured (snapshot 2026-10-08): every role, root included →
`opencode-go/step-5-preview-free`. The `document` role was removed the same day
(never used; no configured model has `pdf` input), so no role needs `pdf` any
more — the old "`document` → muse-spark-contributor-free (the `pdf` exception)"
line is history, not a rule.

Check for a twin before writing any ID:
```
opencode2 models | grep -i "<family>"     # both rows? then check model-preferences.md
```

Known-bad data (2026-09-26): the tracker's `privacy` block (`training`,
`retentionDays`) currently shows models as non-ZDR and is being corrected — do not
draw privacy conclusions from it until the fix lands.

The tracker's `freeModels[]` is the authoritative free list, and a `-free` suffix is
**not** a reliable signal there — some free ids carry no suffix at all. Check
membership in `freeModels[]`, not the slug.

## Stale-cache diagnosis (verified 2026-09-23)

Symptom: `opencode2 models` lacks a model the tracker lists
(e.g. `opencode/<new-slug>-free` absent, only the previously known `opencode/*`
rows). The list is served by the running background service and can lag new
releases.

Fix: run `opencode2 reload`, then re-list. Verified sequence:

```
opencode2 models | grep -iE "free"        # opencode/<new-slug>-free missing
opencode2 reload                          # → "Configuration reloaded"
opencode2 models | grep -iE "free"        # opencode/<new-slug>-free now present
```

If the model is still absent after `reload`, restart the service
(`opencode2 service restart`) and check `service status`. If it is absent after
a restart too, the provider has not published it — check the ocgo-price-tracker
`freeModels[]` to confirm it still exists upstream.

## Rules

- Read `opencode2 models` output as live truth; never guess IDs.
- After any global `opencode.jsonc` model change, run `reload` (or
  `service restart`) so the daemon picks it up.
- Keep this skill about the registry; pricing/UPDATE-vs-KEEP logic lives in
  `model-updater`.
