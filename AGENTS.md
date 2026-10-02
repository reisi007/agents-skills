# AGENTS.md — agents-skills

Central skills repo (`reisi007/agents-skills`). Conventions live in `README.md`;
global wiring is documented in the `agent-config` skill. This file holds only what
must apply while working **in this repo**.

## Commit convention

Amend + `--force-with-lease`, per `agent-config` §6. Exception: brand-new,
self-contained work (e.g. a new skill) gets its own Conventional Commit — the
history shows the pattern (`feat(skill): …`).

## After pull: setup drift check

A `git pull` here can change what the local machine needs — the repo is the source
of truth, the machine is a copy that rots. After pulling, run the drift check from
`agent-config` §8 (rules dir vs. global `instructions`, skills registration, MCP
wiring, hooks) and re-apply setup locally. A new file under `.agents/rules/`
without a matching `instructions` entry in the global config **silently does
nothing** — that is the failure this check exists to catch.

## What does not belong here

- Project-specific skills — those live in their project (`agent-config` ownership
  table). Only own, portable skills and always-on rules live here.
- Third-party packs installed by tools — those stay where the installer put them.
