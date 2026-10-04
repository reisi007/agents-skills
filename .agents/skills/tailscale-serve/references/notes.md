# Tailscale Serve — notes

Background and observed failure narratives for `SKILL.md`. Nothing here is
needed to run the workflow; it explains why the obligations say what they say.

## Why Serve enablement has no workaround

Serve is gated by a tailnet-wide admin-console setting, not by node state. The
observed sequence on an unenabled tailnet: `serve --bg` prints nothing and hangs
until killed (no fail-fast — hence the `timeout 60` obligation); `serve status`
reports `No serve config`; the MagicDNS URL answers `ERR_CONNECTION_REFUSED`.
No flag, config file, or API call changes any of this — the owner must open the
`login.tailscale.com/f/serve` link interactively.

## Why a green `serve status` proves no certificate

Observed: with no usable certificate, `serve --bg` still prints the URL,
`serve status` still lists an `HTTPS` handler, and `serve status --json` still
contains `"HTTPS": true`. The TLS handshake never completes anyway and the
browser reports `ERR_SSL_PROTOCOL_ERROR`. None of the local checks distinguish
"no cert" from "healthy backend" — hence the browser-as-oracle rule, and the
re-check-the-cert-first rule when the fix is uncertain.

## Why the socket is never the default

On hosts where `tailscaled` runs outside the system packaging (user install,
container, custom unit), the daemon listens on a socket under the user's state
dir instead of `/var/run/tailscale/tailscaled.sock` — while the CLI still dials
the default path. The error names a live pid, which is the tell: the daemon is
up, only the rendezvous path is wrong. One observed shape (example only, never
to be copied as a value):

```
$HOME/.local/share/tailscale/tailscaled.sock
```

Always resolve it via the daemon's own cmdline (`Step 0`) and pass `--socket`
explicitly — the CLI ignores socket env vars.

## Why `localhost` breaks the proxy (IPv4 vs IPv6)

`localhost` may resolve to `::1` only, so a dev server binding `localhost`
listens on IPv6 alone. `tailscale serve` dials the IPv4 literal `127.0.0.1`,
finds nothing there, and answers `HTTP 502` — while every `localhost`-based
health check returns `200`. Binding `0.0.0.0` covers the family serve actually
dials; pointing serve at the tailnet IP instead would additionally couple the
proxy to the host's own tailnet route.

## Why the allowedHosts suffix works

Vite's host check allows `localhost`, `*.localhost`, and IP literals; a
MagicDNS name matches none of them. An allowlist entry matches on exact
hostname, or — with a leading `.` — on domain suffix. This was verified against
the check implementation in `vite/dist/node/chunks/node.js` at the time of
writing (not re-verified here — re-check against the installed Vite if the
semantics ever look wrong). The scope ladder in `SKILL.md` (`.ts.net` →
`.<tailnet>.ts.net` → exact node) trades convenience against blast radius; `true`
is excluded because it disables DNS-rebinding protection on a now
all-interfaces, usually unauthenticated dev server.

## Why self-verification fails on userspace hosts

`tailscaled` in `--tun=userspace-networking` mode (no `/dev/net/tun`, no
capabilities — `CapEff: 0`) has no TUN interface: the host cannot route into
its own netstack, so its own tailnet IP and MagicDNS name are unreachable from
inside (`HTTP 000`) regardless of serve health. That is a hard sandbox limit,
not a misconfiguration — chasing it wastes the session. Confirm `serve status`
locally and let the second device report back.

## Why serving a directory is riskier than serving a port

`tailscale serve <directory>` publishes the whole tree, not one app: stray
`.env` files, build artifacts, raw data, and — the classic self-inflicted case —
a `tailscale cert` keypair written into the CWD moments earlier. Hence the audit
obligation before exposing a project root.

## Version note — `cert` output-path flags

`SKILL.md` warns that `cert` writes into the CWD "with no `-o` flag and no path
argument". That absolute held for older CLIs; the locally installed
tailscale v1.102.4 documents `--cert-file`/`--key-file` in `tailscale cert
--help`, so preferring those flags is the cleaner fix where available. The
warning itself still stands — the *default* remains CWD — which is why `SKILL.md`
keeps the `cd`-first mechanism and only mentions the flags as an alternative.
Re-check flag availability if the CLI is much older than v1.102.

## The `PORT` trap

Some environments export a global `PORT` preset that projects reading
`process.env.PORT` obey instead of their own default — surfacing as a confusing
`EADDRINUSE` crash. Starting the dev server with an explicit `PORT=<wanted>`
removes the environment from the equation.
