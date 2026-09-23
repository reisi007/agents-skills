---
name: Update OpenCode Models
description: TRIGGER when the actual OpenCode model list is stale or a model is missing (e.g. a newly released free model like mimo-v2.6-flash-free does not show up), when asking for the opencode models refresh/reload command, or when distinguishing paid opencode-go/* vs free opencode/* model IDs. Reference for listing, refreshing, and diagnosing the live OpenCode model registry.
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

- Paid models → `opencode-go/<slug>` (e.g. `opencode-go/mimo-v2.6-flash`).
- Free models → `opencode/<slug>-free` (e.g. `opencode/mimo-v2.6-flash-free`).

A "missing" free model is often a prefix mistake: searching for
`opencode-go/mimo-v2.6-flash-free` will never match — the correct ID is
`opencode/mimo-v2.6-flash-free`.

## Stale-cache diagnosis (verified 2026-09-23)

Symptom: `opencode2 models` lacks a model the tracker lists
(e.g. `mimo-v2.6-flash-free` absent, only 5 `opencode/*` rows).
The list is served by the running background service and can lag new releases.

Fix: run `opencode2 reload`, then re-list. Verified sequence:

```
opencode2 models | grep -iE "free"        # mimo-v2.6-flash-free missing
opencode2 reload                          # → "Configuration reloaded"
opencode2 models | grep -iE "free"        # mimo-v2.6-flash-free present (6 opencode/* rows)
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
