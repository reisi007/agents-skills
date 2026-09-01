---
name: Permissions
description: TRIGGER when editing, reviewing, or bootstrapping OpenCode permissions in opencode.jsonc, setting up username isolation, secrets/macos privacy denies, .env handling, or external_directory rules. Reference for this machine's security policy and permission ordering (last-match-wins).
---

# Permissions — portable security policy

Generic, reusable reference for an OpenCode `opencode.jsonc` `permissions` array. Replace `<user>` with the actual username.

> For OpenCode permission semantics (rule shape, wildcards, `last-match-wins`, `external_directory` vs `read`/`edit`, `shell` resource handling), load the built-in `opencode` skill — do not duplicate it here.

## 1. Policy template (categories)

Generic template — copy from `references/permissions.jsonc` and substitute `<user>`:

| # | Category | What it does | Key resources |
|---|---|---|---|
| 1 | **Broad tool allows** | Keep agent usable without prompts | `read/edit/shell/skill * → allow` |
| 2 | **Username isolation** | Deny every `/Users/*` home, then re-allow only `/Users/<user>` (last-match-wins). Auto-denies typos and any other username. Covers both dir itself and `/*` children + `shell */Users/<user>*`. | `read/edit/external_directory /Users/* → deny`, `shell */Users/* → deny`, then `.../<user>[/\*] → allow` |
| 3 | **Secrets & credentials** | Hard deny even if username allow would match (must sit *after* the allow) | `~/.ssh/*`, `~/.gnupg/*`, `~/.aws/*`, `~/.config/gcloud/*`, `~/.azure/*`, `~/.kube/*`, `~/.netrc` |
| 4 | **Shell history** | Prevent reading prompt history | `~/.zsh_history`, `~/.bash_history` |
| 5 | **Private macOS data** | Block Keychains, Cookies, Mail, Messages, Safari, TCC, MobileSync | `~/Library/Keychains/*`, `Cookies/*`, `Mail/*`, `Messages/*`, `Safari/*`, `com.apple.TCC/*`, `MobileSync/*` |
| 5a | **Private Linux data** *(optional, Linux)* | Same principle: keyrings, browser profiles, mail stores | `~/.local/share/keyrings/*`, `~/.local/share/kwalletd/*`, `~/.config/google-chrome/*`, `~/.config/chromium/*`, `~/.mozilla/firefox/*`, `~/.thunderbird/*`, `~/.password-store/*` |
| 5b | **Private Windows data** *(optional, Windows)* | Credentials, Edge/Chrome/Firefox profiles, Outlook, DPAPI | `~/AppData/Roaming/Microsoft/Credentials/*`, `~/AppData/Local/Microsoft/Credentials/*`, `~/AppData/Roaming/Microsoft/Protect/*`, `~/AppData/Local/Google/Chrome/*`, `~/AppData/Local/Microsoft/Edge/*`, `~/AppData/Roaming/Mozilla/Firefox/*`, `~/AppData/Roaming/Thunderbird/*` |
| 6 | **.env handling** | Allow example, ask for real envs (first-match in docs, but here ordered for last-match) | `~/dev/*.env*` + `*.env.example → allow`, `*.env` + `*.env.* → ask` |
| 7 | **System config** | Ask before touching `/etc` | `external_directory /etc/*`, `/private/etc/* → ask` |
| 8 | **Temp dirs** | Allow so `/tmp` never prompts (covers `/tmp→/private/tmp` symlink) | `external_directory /tmp/*`, `/private/tmp/* → allow` |
| 9 | **External dev volume** | Treat like `~/dev` | `external_directory /Volumes/Daten/dev/* → allow` |
| 10 | **Tooling** | Homebrew | `external_directory /opt/homebrew/* → allow` |

## 1a. Cross-platform username isolation

macOS uses `/Users/*`, Linux `/home/*`, Windows `C:/Users/*` (and other drive letters). All use forward slashes — OpenCode normalizes them and matches case-insensitive on Windows. Keep the same deny-then-allow pattern per platform:

```jsonc
// Linux (uncomment when porting)
// { "action": "read", "resource": "/home/*", "effect": "deny" },
// { "action": "edit", "resource": "/home/*", "effect": "deny" },
// { "action": "external_directory", "resource": "/home/*", "effect": "deny" },
// { "action": "shell", "resource": "*/home/*", "effect": "deny" },
// { "action": "read", "resource": "/home/<user>", "effect": "allow" },
// { "action": "read", "resource": "/home/<user>/*", "effect": "allow" },
// ... same for edit/external_directory + shell "*/home/<user>*"

// Windows (uncomment when porting — forward slashes, covers C: and D:)
 // { "action": "read", "resource": "C:/Users/*", "effect": "deny" },
 // { "action": "read", "resource": "D:/Users/*", "effect": "deny" },
 // { "action": "shell", "resource": "*C:/Users/*", "effect": "deny" },
 // ... then allow C:/Users/<user> + D:/Users/<user>
```

See `references/permissions.jsonc` §§2b/2c (username) and §§5a/5b (private data).

## 1b. Cross-platform shell history

Add once:
```jsonc
{ "action": "read", "resource": "~/.local/share/history/*", "effect": "deny" }, // cross-platform shells
{ "action": "read", "resource": "~/AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine/*", "effect": "deny" },
{ "action": "read", "resource": "~/.cache/*", "effect": "ask" } // optional: be cautious
```

## 2. Apply / update

```bash
# edit global config
code ~/.config/opencode/opencode.jsonc
# copy ordered block from references/permissions.jsonc into "permissions": [ ... ]
# trigger daemon reload (watches global dir):
touch ~/.config/opencode/opencode.jsonc
opencode2 service status
opencode2 api get /api/health
```

Validation after change:

```bash
node -e "const fs=require('fs');let t=fs.readFileSync(process.env.HOME+'/.config/opencode/opencode.jsonc','utf8');let o='',s=false,e=false;for(let i=0;i<t.length;){let c=t[i];if(s){o+=c;if(e)e=false;else if(c=='\\\\')e=true;else if(c=='\"')s=false;i++}else{if(c=='\"'){s=true;o+=c;i++}else if(c=='/'&&t[i+1]=='/'){while(i<t.length&&t[i]!='\n')i++}else if(c=='/'&&t[i+1]=='*'){i+=2;while(i<t.length&&!(t[i]=='*'&&t[i+1]=='/'))i++;i+=2}else{o+=c;i++}}} JSON.parse(o.replace(/,\s*([}\]])/g,'$1'));console.log('JSONC OK')"
# then test: substitute <user> with actual name first
```

* `read /Users/<user>/dev/...` → allow
* `read /Users/<other>/...` → deny (external_directory)
* `shell cat /Users/<user>/...` → allow, `cat /Users/<other>/...` → deny

## 3. New machine / port

- Substitute `<user>` in blocks 2/2b/2c with the real username (e.g. via `sed -i '' 's/<user>/myname/g' references/permissions.jsonc` before copying).
- Adjust block 9 if the external volume path differs (`/Volumes/Daten/dev`), block 10 if Homebrew prefix differs (`/opt/homebrew` vs `/usr/local` vs `C:/Program Files`).
- Do **not** move block 2 after block 3 — secrets must stay after the username allow so they override it.

## Reference files

- `references/permissions.jsonc` — copy-paste ready ordered `permissions` array (10 active blocks + commented cross-platform §§2b/2c/5a/5b).
