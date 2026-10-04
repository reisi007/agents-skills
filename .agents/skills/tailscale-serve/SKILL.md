---
name: Tailscale Serve
description: TRIGGER when a locally started dev server (Vite/Hono/anything on localhost:PORT) must be reachable from another device on the tailnet, when the user asks for a "Tailscale link"/tailnet URL, or when tailscale fails with "Failed to connect to local tailscaled … /var/run/tailscale/tailscaled.sock: no such file or directory", "Serve is not enabled on your tailnet", ERR_SSL_PROTOCOL_ERROR, HTTP 502 on the MagicDNS URL, or Vite's "Blocked request. This host … is not allowed". Reference for exposing a dev server via `tailscale serve`: the manual Serve prerequisite, the daemon socket path, TLS certificate provisioning, the IPv4-vs-IPv6 localhost trap, the Vite host allowlist, and verifying from a second device.
---

# Tailscale Serve — a local dev server on the tailnet

Exposes a dev server bound to `localhost` so another device on the tailnet can
open it over HTTPS.

Placeholders: `$TS_SOCKET` (daemon socket), `<node>.<tailnet>.ts.net` (this
node's MagicDNS name), `<port>` (dev server port). Resolve live values from the
CLI — never copy them from anywhere else. Rationale lives in
[`references/notes.md`](references/notes.md).

## Prerequisite — the user must enable Serve manually

**`tailscale serve` does not work until Serve is enabled on the tailnet, and no
command can enable it.** It is an admin-console action for the tailnet owner:

```
Serve is not enabled on your tailnet.
To enable, visit:
    https://login.tailscale.com/f/serve?node=<node-id>
```

- Tell the user to open that link and confirm — no flag, config file, or API
  call is a workaround.
- Until then: `serve status` reports `No serve config`, the URL answers
  `ERR_CONNECTION_REFUSED`, and `serve --bg` hangs without failing fast —
  always wrap it in `timeout 60`.

## Step 0 — find the daemon socket

The `Failed to connect … no such file or directory` error names a live pid: the
daemon is **running**, just on a non-default socket. Never start a second
`tailscaled` (`address already in use`). Find the real socket and use it:

```sh
tr '\0' ' ' < /proc/*/cmdline | grep tailscaled   # prints the daemon's real socket path
TS_SOCKET=<socket-from-above>
tailscale --socket=$TS_SOCKET status
```

Pass `--socket` explicitly on **every** command — env vars are ignored; only the
flag counts.

## Step 0.5 — provision the TLS certificate

**`serve` configures HTTPS but does not guarantee a certificate exists.**
Without one the browser reports `ERR_SSL_PROTOCOL_ERROR` while `serve status`
still looks healthy — treat the browser as the only oracle (Step 3).

```sh
cd <private-dir>   # $HOME or a `mktemp -d` dir — never a directory you are about to serve
tailscale --socket=$TS_SOCKET cert <node>.<tailnet>.ts.net
```

Success prints `Wrote …crt` / `…key`. If the URL still fails, re-arm the handler
so serve picks the new cert up:

```sh
tailscale --socket=$TS_SOCKET serve --https=443 off
tailscale --socket=$TS_SOCKET serve --bg http://127.0.0.1:<port>
```

**The private key lands in your CWD** — `cert` writes both files there by
default, so in a served directory the key is fetchable over HTTP (and stays in
git history if committed). Hence the `cd` first; if it already ran in the wrong
place, move the key out and confirm the URL 404s:

```sh
mkdir -p "$HOME/.local/share/tailscale/certs" && chmod 700 "$HOME/.local/share/tailscale/certs"   # example private dir
mv -f <node>.ts.net.crt <node>.ts.net.key "$HOME/.local/share/tailscale/certs/"
chmod 600 "$HOME/.local/share/tailscale/certs/"*.key
curl -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<port>/<node>.ts.net.key   # expect 404
```

## The 0.0.0.0 rule — bind all interfaces

A dev server binding `localhost` may listen on the **IPv6** loopback `::1` only,
while `tailscale serve` dials the **IPv4** literal `127.0.0.1` — `HTTP 502` on
the tailnet URL while `curl http://localhost:<port>` returns `200`.
Disambiguate explicitly:

```sh
curl -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<port>/   # 000 = wrong family
curl -o /dev/null -w "%{http_code}\n" http://[::1]:<port>/        # 200 = actually here
```

- **Listen on `0.0.0.0`:** Vite → `vite --host 0.0.0.0` (= `server.host: true`);
  Node/Hono (`serve({ port })`) → bind all interfaces, not `localhost`.
- Verify: `http://127.0.0.1:<port>/` must return `200`.
- Point serve at `127.0.0.1`, never the tailnet IP — the proxy must not depend
  on the host's own tailnet route.

## The allowedHosts rule — Vite blocks the Tailscale hostname

With the port fixed, Vite's DNS-rebinding protection rejects the MagicDNS name:

```
Blocked request. This host ("<node>.<tailnet>.ts.net") is not allowed.
```

Vite allows `localhost`, `*.localhost`, and IP literals — a MagicDNS name is
none of those. An entry matches on exact hostname, or on suffix with a leading
`.` (`.ts.net` covers every `*.ts.net` subdomain).

```ts
server: {
  host: true,                       // or start with `vite --host 0.0.0.0`
  allowedHosts: [".ts.net"],        // every tailnet node, vendor-neutral
}
```

**Never `allowedHosts: true`.** It skips the check on a server now listening on
`0.0.0.0` with usually no auth — any visited site could DNS-rebind to it.
Ladder, tightest last: `.ts.net` (every tailnet) → `.<tailnet>.ts.net` (one
tailnet) → exact node. Same knob elsewhere: webpack `allowedHosts`/`host`,
Next.js `allowedDevOrigins`.

## Steps 1–2 — verify locally, then expose

```sh
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:<port>/
```

`200` **before** exposing it — never debug a broken dev server through a TLS
proxy. Then:

```sh
tailscale --socket=$TS_SOCKET serve --bg http://127.0.0.1:<port>
tailscale --socket=$TS_SOCKET serve status
```

`--bg` survives the shell; the URL is the MagicDNS name, **https, no port**
(`https://<node>.<tailnet>.ts.net/`, TLS on 443). Multiple ports: repeat
`serve --bg`, each gets its own path or host.

## Step 3 — verify from a second tailnet device

**On a userspace host you cannot verify it yourself** — without a TUN interface
the host's own tailnet URL answers `HTTP 000` even when serve is healthy.
Confirm `serve status` locally, then ask the user to open the URL from another
device and decode their error:

| User sees | Meaning | Fix |
| --- | --- | --- |
| `ERR_SSL_PROTOCOL_ERROR` | serve up, **no usable certificate** (`serve status` still looks green — ignore it) | Step 0.5 |
| `HTTP 502` | backend unreachable | 0.0.0.0 rule |
| `Blocked request … not allowed` | backend reachable, host header rejected | allowedHosts rule |
| `ERR_CONNECTION_REFUSED` | serve not running, or Serve not enabled | prerequisite |
| private `.key` reachable under the served URL | `cert` ran in a served CWD | move it out, verify 404 |
| page renders | done | — |

When the fix is uncertain, **re-check the certificate before re-diagnosing the
backend** — the two failure modes look identical locally.

## Cleanup

```sh
tailscale --socket=$TS_SOCKET serve status           # what is exposed right now
tailscale --socket=$TS_SOCKET serve --https=443 off  # drop just the :443 handler
tailscale --socket=$TS_SOCKET serve reset            # remove all serve config
```

## Environment caveats

Check whether these apply before debugging — none is tied to one machine:

- The daemon socket is often **not** at the default path — find it via
  `/proc/*/cmdline` (Step 0). Minimal containers lack `ps`/`pkill`: list via
  `/proc/*/cmdline`, stop with `kill`.
- No `/dev/net/tun` and no capabilities means `tailscaled` can only run with
  `--tun=userspace-networking`: a hard limit, not a misconfiguration — local
  verification of serve is then impossible (Step 3).
- A `PORT` preset in the environment hijacks projects reading
  `process.env.PORT` (crash with `EADDRINUSE` instead of their default) — start
  them with an explicit port.
- Serving a **directory** exposes everything in it: audit for secrets, `.env`
  files, key material, and raw data before exposing a project root.

**Secrets:** `TS_AUTHKEY` / `TS_TAILSCALE_HOSTNAME` may sit in the environment —
pass an auth key to `tailscaled` only, never into files, logs, answers, or
commits. Never write host-identifying data (node names, tailnet IPs, LAN
addresses, hostnames) into a published skill: record the *pattern*, read live
values from the CLI.

## Reference files

- `references/notes.md` — rationale, observed failure narratives, version notes.
