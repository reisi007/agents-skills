# Data sources — raw JSON endpoints (do NOT scrape the website)

Both trackers commit `data/latest.json` and `CHANGELOG.json` to `main` and serve
`data/latest.json` from the live site. The raw GitHub URLs below are the canonical
machine-readable source. They are tiny (~30–50 KB) and structured — far cheaper than
rendering the HTML site.

## ocgo-pricing (OpenCode Go + Default) — `opencode-go/<slug>` and `opencode/<slug>` IDs

```
RAW=https://ocgo-pricing.all-the.rest

# Current snapshot, slimmed to what the skill needs:
curl -sL $RAW/data/latest.json | jq '{
  fetchedAt,
  peakRules,
  plans:  [ .plans[] | {id, priceMonthly, creditsMonthly} ],
  models: [ .models[] | {id, name, tier, provider, contextWindow, usage,
                          input, output, cachedRead, cachedWrite, pattern,
                          caps: .capabilities.input} ],
  free:   [ .freeModels[] | {id, name, contextWindow, caps: .capabilities.input} ]
}'

# Example: print effective input prices for every tier of one model and plan.
# For a known workload, use the row mapped by that model's peakRules; if unknown,
# use the highest paid value as the conservative comparison/cap value.
#   paid basis: input × priceMonthly  / usage[plan]   ← what the subscription charges
#   full basis: input × creditsMonthly / usage[plan]  ← credit value at list rate
curl -sL $RAW/data/latest.json | jq -r '
  (.plans[] | select(.id == "go")) as $p
  | .models[]
  | select(.id == "opencode-go/deepseek-v4.1-flash" and .usage.go != null)
  | "\(.id) [\(.tier)]\tpaid=\(.input * $p.priceMonthly / .usage.go)\tfull=\(.input * $p.creditsMonthly / .usage.go)"'

# Changelog — last 15 entries with their typed changes flattened:
curl -sL https://raw.githubusercontent.com/all-the-rest/ocgo-price-tracker/main/CHANGELOG.json \
  | jq '[.entries[:15][] | .date as $d | .changes[] | . + {date: $d}]'
```

### No precomputed effective prices

The snapshot carries list prices plus the plan's `priceMonthly`/`creditsMonthly`
and per-model `usage`; it deliberately ships **no** `effectiveInput`/
`effectiveOutput` and no `monthlyCredit`/`monthlyCost` (those fields no longer
exist). A recipe that selects them prints `null`. This does not mean every snapshot
field is non-null: source prices such as `cachedWrite` may be `null` when the tracker
has no documented price. Compute the basis you need with the snippet above; the
tracker's math lives in `ocgo-price-tracker/src/weighted.ts`.

### Nullable cached-write price

Keep `cachedWrite` visible as `null` when the source has no documented cached-write
price; do not treat that value as zero. For request-cost estimates only, both trackers
fall back to the model's `input` price when `cachedWrite` is null
(`writeRaw ?? input` in `ocgo-price-tracker/src/weighted.ts` and
`cc-price-tracker/src/weighted.ts`). The raw snapshot field remains null, and this
fallback does not change direct price comparisons or the paid-basis cap.

### `capabilities` is an object — check `.input`

```jsonc
"capabilities": { "input": ["text","image","video","pdf"], "output": ["text"],
                  "reasoning": true, "toolCall": true }
```

- Vision check (the hard requirement): `"image" in .capabilities.input`.
  `(.capabilities | index("image"))` is **always null** — it searches the object's
  values, not the input list, and silently reports every model as text-only.
- Text-only models in the current snapshot (never recommend these):
  `curl -sL $RAW/data/latest.json | jq -r '.models[] | select((.capabilities.input|index("image"))|not) | .id'`

## cc-price-tracker (Command Code) — `provider/model` IDs (supplementary)

```
RAW=https://raw.githubusercontent.com/all-the-rest/cc-price-tracker/main

curl -sL $RAW/data/latest.json | jq '{
  fetchedAt,
  plans:  [ .plans[] | {id, priceMonthly, creditsMonthly} ],
  models: [ .models[] | {id, name, tier, provider, contextWindow, allowances,
                          input, output, cachedRead, cachedWrite, pattern,
                          caps: .capabilities.input} ],
  free:   [ .freeModels[] | {id, name, caps: .capabilities.input} ]
}'

curl -sL $RAW/CHANGELOG.json | jq '.entries[:15]'
```

Same `capabilities` object shape as OCG — the `"image" in .capabilities.input`
check works identically here.

## User's configured models (from global OpenCode config)

`opencode.jsonc` is **JSONC**, so plain `jq` chokes on it. The global config uses
**both** `//` and `/* … */` comments (41 block comments as of 2026-09-26) — a
stripper that only handles `//` produces invalid JSON, so handle both plus
trailing commas. Since 2026-10-18 the config carries the root `model` **plus** one
`agents.<role>.model` per role — this prints every configured id:

```js
// node strip-jsonc.js   (or paste as a single-quoted `node -e '…'`)
const fs = require("fs");
const t = fs.readFileSync(process.env.HOME + "/.config/opencode/opencode.jsonc", "utf8");
let o = "", s = false, e = false;
for (let i = 0; i < t.length;) {
  const c = t[i];
  if (s) { o += c; if (e) e = false; else if (c === "\\") e = true; else if (c === '"') s = false; i++; }
  else if (c === '"') { s = true; o += c; i++; }
  else if (c === "/" && t[i+1] === "/") { while (i < t.length && t[i] !== "\n") i++; }
  else if (c === "/" && t[i+1] === "*") { i += 2; while (i < t.length && !(t[i] === "*" && t[i+1] === "/")) i++; i += 2; }
  else { o += c; i++; }
}
const c = JSON.parse(o.replace(/,\s*([}\]])/g, "$1"));
console.log("default\t" + c.model);
for (const [role, a] of Object.entries(c.agents || {})) if (a.model) console.log(role + "\t" + a.model);
```

Verified output shape on a real config (IDs omitted — the namespace is what matters).
Current rule since 2026-10-18 is `opencode-go-only`: root `model` plus per-role
models for `plan`/`general`/`build`/`explore`, all on `opencode-go/`; the earlier
rules (`opencode-go-mixed` 2026-10-16..2026-10-18, one-$0-family
2026-10-08..2026-10-16, the same-day single-root phase) are retired. An
`opencode-go/<slug>` id only counts as a REPLACE while `model-preferences.md`
carries a free-tier namespace rule — it does not (see the namespace rule in
SKILL.md).

```
default   opencode-go/<id>
plan      opencode-go/<id>
general   opencode-go/<id>
build     opencode-go/<id>
explore   opencode-go/<id>
```

Then check every model against the hard requirement
(`"image" in .capabilities.input`).
Alternatively,
just **read the small file directly** and collect the root `model` plus each
`agents.<role>.model` by eye — no tooling required.

## Notes

- `raw.githubusercontent.com` is unauthenticated and rate-limited (~60 req/h). For
  repeated/automated pulls use `gh api` instead, e.g.
  `curl -sL https://ocgo-pricing.all-the.rest/data/latest.json`.
- GitHub Releases are created per changelog entry (tag = entry `id`); `releases.atom`
  is the RSS feed if you want change notifications rather than polling.
- `src/data/changelog.json` is bundled into the site's JS and is **not** a standalone
  endpoint — always use `https://raw.githubusercontent.com/all-the-rest/ocgo-price-tracker/main/CHANGELOG.json` for raw access.
