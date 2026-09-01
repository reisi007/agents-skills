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
  free:   [ .freeModels[] | {id, name, contextWindow} ]
}'

# Changelog — last 15 entries:
curl -sL $RAW/CHANGELOG.json | jq '.entries[:15]'
```

## cc-price-tracker (Command Code) — `provider/model` IDs (supplementary)

```
RAW=https://raw.githubusercontent.com/all-the-rest/cc-price-tracker/main

curl -sL $RAW/data/latest.json | jq '{
  fetchedAt,
  models: [ .models[] | {id, name, provider, contextWindow, usage: .allowances,
                          effectiveInput, effectiveOutput, caps: .capabilities} ],
  free:   [ .freeModels[] | {id, name, contextWindow} ]
}'

curl -sL $RAW/CHANGELOG.json | jq '.entries[:15]'
```

## User's configured models (from global OpenCode config)

`opencode.jsonc` is **JSONC** (contains `//` comments), so plain `jq` chokes on it.
Use this `node` one-liner (string-aware comment strip) to print `role<TAB>modelID`
for the root `model` plus every `agent.<role>.model`:

```
node -e '
const fs=require("fs");
let s=fs.readFileSync(process.env.HOME+"/.config/opencode/opencode.jsonc","utf8");
let o="",inS=false,e=false;
for(let i=0;i<s.length;i++){const c=s[i];if(inS){o+=c;if(e)e=false;else if(c==="\\")e=true;else if(c==="\"")inS=false;}else{if(c==="\""){inS=true;o+=c;}else if(c==="/"&&s[i+1]==="/"){while(i<s.length&&s[i]!=="\n")i++;if(i<s.length)o+="\n";}else o+=c;}}
const c=JSON.parse(o);
const m={default:c.model};
for(const [k,v] of Object.entries(c.agent||{})) if(v&&v.model) m[k]=v.model;
for(const [k,v] of Object.entries(m)) console.log(k+"\t"+v);
'
```

(e.g. `default  opencode-go/hy3`, `vision  opencode-go/mimo-v2.5`). Alternatively,
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
