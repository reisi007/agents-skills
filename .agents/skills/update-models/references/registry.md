# Registry — live OpenCode model list

Detail for the registry half of the `update-models` skill. Everything here is about what
`opencode models` actually reports; UPDATE/KEEP advice lives in `pricing.md` and the
obligations in `SKILL.md`.

## Commands

```sh
opencode models                    # list all available models (via background service)
opencode models | grep -i free     # free models only
opencode reload                    # refresh cached config + model list ("Configuration reloaded")
opencode service restart           # heavier reset if reload is not enough
opencode service status            # verify daemon health afterwards
```

There is **no** dedicated `models refresh` subcommand — `reload` is the refresh
path. `opencode` is the real CLI binary, installed at **`~/.opencode/bin/opencode`**
and on `PATH` — call it as `opencode`.

## Provider prefix gotcha

- Paid models → `opencode-go/<slug>` (e.g. `opencode-go/<family>-<ver>-flash`).
- Free models → `<slug>-free` under **both** prefixes (e.g.
  `opencode/<family>-<ver>-flash-free` *and* `opencode-go/<family>-<ver>-flash-free`).

A "missing" model is often a prefix mistake — but note which direction. Older free
models appeared only under `opencode/`, so searching `opencode-go/<slug>-free` found
nothing. That is no longer true: free models (snapshot 2026-10-02:
`space-bunny-free`, `longcat-2.5-preview-free`, `muse-spark-1.3-contributor-free` —
re-check with `opencode models | grep -i free`) are listed under **both** prefixes.
Never conclude "no such model" from one prefix alone — grep the family name and look
at every row that comes back.

## Which namespace belongs on which role

**Rule: follow `~/.config/opencode/model-preferences.md` — never the slug, and never a
stale snapshot of this file.** Current standing decision (2026-10-16): everything runs
on `opencode-go/`, mixed paid + free — main agents on the paid `deepseek-v4.1-flash`,
`vision-creative` on the paid `glm-5.3-flash`, fan-out/background on the $0
`longcat-2.5-preview-free`. The previous single-$0-model decision (2026-10-08,
`opencode-go/step-5-preview-free`) is **dead**: the provider removed that model
2026-10-15 (`free_removed`; available only 2026-10-08..2026-10-15). Do not "fix" a
configured `opencode-go/<slug>` into an `opencode/<slug>` twin.

- The **`opencode/`** provider namespace is the free tier → use it whenever it exists
  **and** the preferences say so. Since 2026-10-16 the config does **not** use it: the
  free twin of the main-agent model is only 200k ctx.
- The **`opencode-go/`** namespace is the subscription one → since 2026-10-16 it
  carries both the paid main-agent/`vision-creative` models and the $0
  `longcat-2.5-preview-free`, so the namespace alone says nothing about price. Check
  the registry, not the prefix.

Price is frequently identical (`effectiveInput: 0` either way). The reason for the
2026-10-16 split is the user decision of that day (speed + context bars), **not** ZDR
and not rename durability. A slug ending in `-free` says nothing about namespace,
price, or privacy; check the registry instead of inferring.

**History:** "always the `opencode-go/<slug>` twin because the subscription is ZDR"
(until 2026-10-02), "always the `opencode/<slug>` twin because the setup is
free-tier-only" (2026-10-02 until 2026-10-08), and "one $0 model family for every
role" (2026-10-08 until 2026-10-16) are all retired. Do not revive them, and do not
treat a configured id in either namespace as a mistake to correct — the preferences
file is the arbiter.

Configured (snapshot 2026-10-16): main agents + `vision-creative` on paid `opencode-go/`
models, fan-out/background on `$0` `opencode-go/longcat-2.5-preview-free`. The
`document` role was removed 2026-10-08 (never used); no role *needs* `pdf`, though
`glm-5.3-flash` (`vision-creative`) does carry it. The old "`document` →
muse-spark-contributor-free (the `pdf` exception)" line is history, not a rule.

Check for a twin before writing any ID:

```
opencode models | grep -i "<family>"     # both rows? then check model-preferences.md
```

Known-bad data (2026-09-26): the tracker's `privacy` block (`training`,
`retentionDays`) currently shows models as non-ZDR and is being corrected — do not
draw privacy conclusions from it until the fix lands.

The tracker's `freeModels[]` is the authoritative free list, and a `-free` suffix is
**not** a reliable signal there — some free ids carry no suffix at all. Check
membership in `freeModels[]`, not the slug.

## Stale-cache diagnosis (verified 2026-09-23)

Symptom: `opencode models` lacks a model the tracker lists (e.g.
`opencode/<new-slug>-free` absent, only the previously known `opencode/*` rows). The
list is served by the running background service and can lag new releases.

Fix: run `opencode reload`, then re-list. Verified sequence:

```
opencode models | grep -iE "free"        # opencode/<new-slug>-free missing
opencode reload                          # → "Configuration reloaded"
opencode models | grep -iE "free"        # opencode/<new-slug>-free now present
```

If the model is still absent after `reload`, restart the service
(`opencode service restart`) and check `service status`. If it is absent after a
restart too, the provider has not published it — check the ocgo-price-tracker
`freeModels[]` to confirm it still exists upstream.

## Rules

- Read `opencode models` output as live truth; never guess IDs.
- After any global `opencode.jsonc` model change, run `reload` (or `service restart`)
  so the daemon picks it up.
- Keep this file about the registry; pricing/UPDATE-vs-KEEP logic lives in
  `pricing.md`.
