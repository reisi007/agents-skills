# Data sources — raw JSON endpoints (do NOT scrape the website)

Both trackers commit `data/latest.json` and `CHANGELOG.json` to `main` and serve
`data/latest.json` from the live site. The raw GitHub URLs below are the canonical
machine-readable source. They are tiny (~30–50 KB) and structured — far cheaper than
rendering the HTML site.

## ocgo-price-tracker (OpenCode Go) — `opencode-go/<slug>` IDs

```
RAW=https://raw.githubusercontent.com/all-the-rest/ocgo-price-tracker/main

# Current snapshot, slimmed to what the skill needs:
curl -sL $RAW/data/latest.json | jq '{
  fetchedAt, monthlyCredit, monthlyCost,
  models: [ .models[] | {id, name, tier, provider, contextWindow, usage,
                          effectiveInput, effectiveOutput, caps: .capabilities} ],
  free:   [ .freeModels[] | {id, name, contextWindow, caps: .capabilities} ]
}'

# Changelog — last 15 entries:
curl -sL $RAW/CHANGELOG.json | jq '.entries[:15]'
```

### `capabilities` is an object — check `.input`

```jsonc
"capabilities": { "input": ["text","image","video","pdf"], "output": ["text"],
                  "reasoning": true, "toolCall": true }
```

- Vision check (the hard requirement): `"image" in .capabilities.input`.
  `(.capabilities | index("image"))` is **always null** — it searches the object's
  values, not the input list, and silently reports every model as text-only.
- `pdf` is a separate entry — vision-capable does not imply PDF-capable.
- Text-only models in the current snapshot (never recommend these):
  `curl -sL $RAW/data/latest.json | jq -r '.models[] | select((.capabilities.input|index("image"))|not) | .id'`

## cc-price-tracker (Command Code) — `provider/model` IDs (supplementary)

```
RAW=https://raw.githubusercontent.com/all-the-rest/cc-price-tracker/main

curl -sL $RAW/data/latest.json | jq '{
  fetchedAt,
  models: [ .models[] | {id, name, provider, contextWindow, usage: .allowances,
                          effectiveInput, effectiveOutput, caps: .capabilities} ],
  free:   [ .freeModels[] | {id, name, contextWindow, caps: .capabilities} ]
}'

curl -sL $RAW/CHANGELOG.json | jq '.entries[:15]'
```

Same `capabilities` object shape as OCG — the `"image" in .capabilities.input`
check works identically here.

## User's configured models (from global OpenCode config)

`opencode.jsonc` is **JSONC**, so plain `jq` chokes on it. The global config uses
**both** `//` and `/* … */` comments (41 block comments as of 2026-09-26) — a
stripper that only handles `//` produces invalid JSON, so handle both plus
trailing commas. This prints `role<TAB>modelID` for the root `model` plus every
`agent.<role>.model`:

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
const m = { default: c.model };
for (const [k, v] of Object.entries(c.agent || {})) if (v && v.model) m[k] = v.model;
for (const [k, v] of Object.entries(m)) console.log(k + "\t" + v);
```

Verified output shape on a real config (IDs omitted — the roles are what matter).
Every id is on `opencode-go/` here: the subscription is ZDR, so that namespace wins
whenever a twin exists. An `opencode/<slug>` id in the output is a REPLACE — see the
namespace hard rule in SKILL.md.

```
default	opencode-go/<id>
plan	opencode-go/<id>
vision-creative	opencode-go/<id>
document	opencode-go/<different-id>
free	opencode-go/<id>
nonsensitive	opencode-go/<id>
```

Then check every emitted model against the hard requirement
(`"image" in .capabilities.input`) — `document` must also pass `pdf`.
Alternatively,
just **read the small file directly** and collect the `model` / `agent.<role>.model`
values by eye — no tooling required.

## Notes

- `raw.githubusercontent.com` is unauthenticated and rate-limited (~60 req/h). For
  repeated/automated pulls use `gh api` instead, e.g.
  `gh api repos/all-the-rest/ocgo-price-tracker/contents/data/latest.json --jq '.content' | base64 -d`.
- The site also serves `/data/latest.json` (e.g. `https://ocgo-pricing.all-the.rest/data/latest.json`)
  if you prefer the live build over git `main`.
- GitHub Releases are created per changelog entry (tag = entry `id`); `releases.atom`
  is the RSS feed if you want change notifications rather than polling.
- `src/data/changelog.json` is bundled into the site's JS and is **not** a standalone
  endpoint — always use the repo's root `CHANGELOG.json` for raw access.
