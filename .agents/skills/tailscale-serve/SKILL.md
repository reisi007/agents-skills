---
name: Tailscale Serve
description: TRIGGER when a locally started dev server (Vite/Hono/anything on localhost:PORT) must be reachable from another device on the tailnet, when the user asks for a "Tailscale link"/tailnet URL, or when tailscale fails with "Failed to connect to local tailscaled … /var/run/tailscale/tailscaled.sock: no such file or directory", "Serve is not enabled on your tailnet", HTTP 502 on the MagicDNS URL, or Vite's "Blocked request. This host … is not allowed". Reference for exposing a dev server via `tailscale serve`: the manual Serve prerequisite, the daemon socket path, the IPv4-vs-IPv6 localhost trap, the Vite host allowlist, and verifying from a second device.
---

# Tailscale Serve — a local dev server on the tailnet

Exposes a dev server bound to `localhost` so another device on the tailnet can
open it over HTTPS. Generic workflow — host-specific values live in
**Host facts** at the bottom.

Placeholders used below: `$TS_SOCKET` (daemon socket), `<node>.<tailnet>.ts.net`
(the node's MagicDNS name), `<port>` (the dev server port).

## Prerequisite — the user must enable Serve manually

**`tailscale serve` does not work until Serve is enabled on the tailnet, and no
command can enable it.** It is an admin-console setting that needs the tailnet
owner's account:

```
Serve is not enabled on your tailnet.
To enable, visit:
    https://login.tailscale.com/f/serve?node=<node-id>
```

- Tell the user to open that link and confirm. Do **not** look for a workaround
  (no flag, no config file, no API call) — it is an interactive admin action.
- Until then `serve status` reports `No serve config` and the URL answers
  `ERR_CONNECTION_REFUSED`.
- The CLI does **not** fail fast here: `serve --bg` hung for minutes and only
  printed the message once the process was killed. Always wrap it:
  `timeout 60 tailscale … serve --bg …`.

## Step 0 — find the daemon socket

If `tailscale` reports `Failed to connect to local tailscaled (pid N) …
/var/run/tailscale/tailscaled.sock: no such file or directory`, the daemon is
**running** — the message even names a live pid — just not on the default path.
Do not start a second `tailscaled`; it dies with `address already in use`.

```sh
TS_SOCKET=$HOME/.local/share/tailscale/tailscaled.sock
tailscale --socket=$TS_SOCKET status
```

Pass `--socket` explicitly on every command. An env var like `TS_SOCKET` is
typically **ignored** by the CLI — only the flag counts. Without `ps`:
`tr '\0' ' ' < /proc/*/cmdline | grep tailscaled`.

## The 0.0.0.0 rule — bind all interfaces

**The most common cause of a 502 on the tailnet URL.**

Vite binds `localhost`, which on many systems resolves to the **IPv6** loopback
`::1` only. `tailscale serve` dials the **IPv4** literal `127.0.0.1`. The proxy
cannot connect and answers `HTTP 502` — while `curl http://localhost:<port>`
happily returns `200`, so the dev server looks perfectly healthy.

Compare the two stack families explicitly:

```sh
curl -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<port>/   # 000 = wrong family
curl -o /dev/null -w "%{http_code}\n" http://[::1]:<port>/        # 200 = actually here
```

**A dev server that will be proxied must listen on `0.0.0.0`.**

- Vite: `vite --host 0.0.0.0` (equivalent to `server.host: true`)
- Node/Hono (`serve({ port })`): bind all interfaces, not `localhost`
- Verify afterwards: `http://127.0.0.1:<port>/` must return `200`.

Point `tailscale serve` at `127.0.0.1`, not the tailnet IP, so the proxy never
depends on the host's own tailnet route.

## The allowedHosts rule — Vite blocks the Tailscale hostname

Once the port is right, Vite's own DNS-rebinding protection rejects the request:

```
Blocked request. This host ("<node>.<tailnet>.ts.net") is not allowed.
```

Vite allows `localhost`, `*.localhost` and any IP literal by default; a MagicDNS
name is none of those, so it must be allowlisted. Semantics (verified in
`vite/dist/node/chunks/node.js`): an entry matches if it is **exactly** the
hostname, or if it **starts with `.`** and the hostname ends with that suffix
(so `.ts.net` allows `ts.net` itself plus every `*.ts.net` subdomain).

```ts
server: {
  host: true,                       // or start with `vite --host 0.0.0.0`
  allowedHosts: [".ts.net"],        // every tailnet node, vendor-neutral
}
```

**Do not use `allowedHosts: true`.** It skips the check entirely. Since the
server now listens on `0.0.0.0` and dev APIs usually have no auth, any site the
user visits could DNS-rebind to the dev server and read its data. Prefer a
narrower allowlist:

| Value | Scope |
| --- | --- |
| `.ts.net` | every tailnet on the internet — convenient, vendor-neutral |
| `.<tailnet>.ts.net` | only that tailnet's nodes — tighter, same convenience |
| `["<node>.<tailnet>.ts.net"]` | exactly one node |

Other dev servers have the same knob under a different name (webpack
`allowedHosts`/`host`, Next.js `allowedDevOrigins`) — same reasoning applies.

## Step 1 — verify locally

```sh
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:<port>/
```

`200` **before** exposing it — otherwise you debug a broken dev server through a
TLS proxy.

## Step 2 — expose it

```sh
tailscale --socket=$TS_SOCKET serve --bg http://127.0.0.1:<port>
tailscale --socket=$TS_SOCKET serve status
```

- `--bg` keeps it running past the shell.
- The URL is the node's MagicDNS name, **https, no port**:
  `https://<node>.<tailnet>.ts.net/` — TLS terminates on 443, the real port
  never appears.
- Multiple ports: repeat `serve --bg`; each gets its own path or host.

## Step 3 — verify from a second tailnet device

**On a userspace host you cannot verify it yourself.** `tailscaled` in
`--tun=userspace-networking` mode has no TUN interface, so the host cannot route
into its own netstack: `curl https://<node>.<tailnet>.ts.net/` from inside
returns `HTTP 000` even when serve is healthy, and a normally-bound listening
socket is likewise not reachable over the tailnet IP.

So: confirm `serve status` locally, then ask the user to open the URL from
another device and report back. Decode their error:

| User sees | Meaning |
| --- | --- |
| `HTTP 502` | TLS+serve fine, backend unreachable → apply the 0.0.0.0 rule |
| `Blocked request … not allowed` | backend reachable, host header rejected → allowedHosts rule |
| `ERR_CONNECTION_REFUSED` | serve not running, or Serve not enabled → prerequisite |
| page renders | done |

## Gotchas

| Symptom | Cause | Fix |
| --- | --- | --- |
| `502` on the tailnet URL, `localhost` fine | server bound to `::1` only | bind `0.0.0.0` |
| `Blocked request. This host … is not allowed` | Vite host check | allowlist the tailnet domain |
| `ERR_CONNECTION_REFUSED` | Serve not enabled on the tailnet | user opens the `login.tailscale.com/f/serve` link |
| `Failed to connect to local tailscaled … /var/run/…` | non-default socket | add `--socket=$TS_SOCKET` |
| `address already in use` starting tailscaled | one is already running | don't start one — use `--socket` |
| API crashes with `EADDRINUSE` | `PORT` preset in the environment | start with `PORT=<wanted>` explicitly |
| `serve --bg` prints nothing and hangs | CLI blocks until killed when not enabled | wrap in `timeout` |
| `command not found: ps` / `pkill` | minimal container | list via `/proc/*/cmdline`, stop with `kill` |

**Secrets:** an auth key may sit in the environment (`TS_AUTHKEY`,
`TS_TAILSCALE_HOSTNAME`). It is a secret — pass it to `tailscaled`, never echo it
into files, logs, answers, or commits.

## Cleanup

```sh
tailscale --socket=$TS_SOCKET serve status           # what is exposed right now
tailscale --socket=$TS_SOCKET serve --https=443 off  # drop just the :443 handler
tailscale --socket=$TS_SOCKET serve reset            # remove all serve config
```

## Environment caveats

Not tied to any one machine — check whether these apply before you debug.

- The daemon socket is often **not** at `/var/run/tailscale/`. Find the real
  one with `tr '\0' ' ' < /proc/*/cmdline | grep tailscaled`, then pass it via
  `--socket`.
- On a userspace host (`--tun=userspace-networking`, no TUN interface) you
  cannot reach the node's own tailnet IP or MagicDNS name from inside at all.
  See Step 3.
- A `PORT` preset in the environment can hijack projects that read
  `process.env.PORT`; they then crash with `EADDRINUSE` instead of using their
  intended default. Start them with an explicit port.
- Minimal containers ship without `ps` and `pkill`. Enumerate
  `/proc/*/cmdline` and stop processes with `kill`.

Never write host-identifying data into a published skill: node names, tailnet
IPs, LAN addresses, hostnames. Record the *pattern* (socket path shape, env
trap), not the *value* — and read live values from the CLI.
