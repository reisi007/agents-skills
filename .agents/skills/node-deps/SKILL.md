---
name: Node Dependency Policy
description: TRIGGER when a Node/pnpm project pins dependency versions (exact versions in package.json without ^/~ range, minimumReleaseAgeExclude entries in pnpm-workspace.yaml, a packageManager version pin), when a dependency update, security fix or audit finding is due, or when the user asks how dependencies should be managed. Reference for the no-pins rule: ranges in package.json, updates exclusively via pnpm into the lockfile, never as pins.
---

# Node Dependency Policy — no pins, updates via pnpm into the lockfile

**Rule:** Dependency versions are never pinned. Updates land
exclusively via pnpm in the lockfile (`pnpm-lock.yaml`), never as fixed
versions in the manifest or workspace config.

## Forbidden

- **Exact versions in `package.json`** — every dependency (dependencies
  and devDependencies) carries a range (`^x.y.z`, the default). A version
  without `^`/`~` is a pin: convert it to a range, don't "update" it.
- **`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`** — (was a
  supply-chain policy, now discarded). Delete entries outright; if the
  list is then empty, remove the whole key.
- **`packageManager` pin in `package.json`** — no `pnpm@x.y.z` entry. The
  locally installed pnpm version applies (possibly different per machine);
  a pin breaks setups with a different local version. Exception CI: there
  `pnpm/action-setup` needs a version — it goes as a major line
  (`version: 11`) in the workflow input, never as an exact pin, never in
  `package.json`.

## Boundary: manifests vs images

Ranges stay in `package.json`; resolved versions belong in images and CI
build args (e.g. `ARG PLAYWRIGHT_VERSION` taken from the lockfile).
Reading a caret range into a build arg yields the range's lower bound, not
the resolved version — see the `docker-test-image` skill for the lockfile rule.

## Updates (only this way)

- Security fixes: `pnpm audit --fix=update` (not `override` — that writes
  `pnpm.overrides` pins; `update` stays within the ranges) — writes to the
  lockfile, leaves `package.json` untouched.
- Routine bumps: `pnpm update` (optionally targeted `pnpm update <pkg>`).
- Then verify: `pnpm install --frozen-lockfile` must be green plus the
  project's own check from its `AGENTS.md` (at minimum typecheck/build).

## On encountering a pin

1. Remove the pin (range instead of exact version / delete key or entry).
2. `pnpm install` (let the lockfile resolve).
3. Project check green (typecheck/build).
4. Commit as `chore(deps)` — not a feature, not a fix.
