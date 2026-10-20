---
name: Security Review
description: 'Commissioned security review of a reachable surface: enumerate every route/endpoint programmatically, prove each finding with a reproducing command, then close ALL findings in waves and pin each one with a test. TRIGGER only on explicit request — "security review", "security audit", "Sicherheitsüberprüfung", "check every endpoint for public access". NOT for normal feature work, a single bug fix, dependency CVEs (that is `node-deps`), or visual QA (that is `ui-review`).'
metadata:
  opencode/autoinvoke: false
---

# Security Review — find every surface, then close every finding

A commissioned security pass has two halves, in this order: **find** — enumerate
every reachable surface programmatically and prove every finding — and **close** —
resolve every finding in waves. The deliverable is **not the finding list**: it is
the closed, pinned set. A finding that was found and not closed is *named open
work*, never a silently dropped line.

Reference run (portal.reisinger.pictures, Laravel 13 + React, 2026-10-18):
`php artisan route:list --json` → **189 routes, 150 with `auth:api`, 39 without**.
Three findings: an anonymous pricing endpoint outside every middleware group and a
framework route serving `storage/app/private` unauthenticated were closed in an
independently verified wave; a public catalog endpoint was carried as an explicit
report-only decision.
Those numbers describe that run, not a rule: the population is always this
project's own.

## Stage 0 — Ground rules

- **Read-only until the owner decides.** Enumerate and prove; change nothing
  before the Stage 4 decisions are in.
- **Evidence before claim.** Every finding carries a reproducing command and its
  output. "Looks unauthenticated" is not a finding.
- **No secrets** in the report, a commit or the chat — name the key and the path,
  never the value.
- **Access-model questions go to the owner through the `question` tool only**
  (options, recommendation first) — never as a prose question, which is gone by
  the next turn.
- **The false-positive gate (Stage 3) is a gate.** No wave starts before it passes.

## Stage 1 — Enumerate every surface, programmatically

Never from memory and never from a single `grep`. The inventory comes from the
framework itself — Laravel: `php artisan route:list --json` (skeleton:
`templates/laravel-route-audit.php`). Classify authenticated vs. not, and **always
name the population** — `N routes, M without auth`, never "some".

Then walk each surface class; recipes with commands: `references/enumeration.md`.

| Surface | What to look for |
|---|---|
| Config-driven exposure | static serving (`filesystems.disks.*.serve`), debug mode, dev tools (Telescope/Horizon/Debugbar), permissive CORS, catch-all routes |
| Secrets | tracked `.env`, git history, hardcoded fallbacks (`env('KEY','secret')`), artifacts inside a served directory |
| Authz | authenticated ≠ authorized: IDOR, tenant/brand scoping, a role a broader role also passes, writes wider than reads |
| Consumers | cross-repo callers (marketing site, scripts, apps) — find them **before** changing a contract |

## Stage 2 — Classify every finding

One row per finding: `file:line` (or route/command), a severity from the
canonical levels (`ratchet-gates`, `references/vocabulary.md`), evidence, and
class `BELEGT` / `HEURISTIK` / `AKZEPTIERT`. **Severity = reach × impact** (the
method: `references/findings-and-waves.md`), not how alarming the word sounds —
and the **consumers decide the impact**: an anonymous endpoint nothing reads is
not the same finding as one a live client depends on.

## Stage 3 — The false-positive gate (before the first wave)

Every finding answers the same questions before it is allowed into a wave:

- Does the criterion apply to this surface at all?
- Was the field **measured**, or guessed from a name?
- Is correct behaviour being reported as a defect — a deliberately public
  endpoint, a token-credential flow, a signature-checked webhook?
- Is the evidence only your own input echoed back?

A finding that fails is **openly retracted** (`ZURÜCKGENOMMEN`) with its cause, or
**replaced by a real finding** — never silently deleted. Otherwise a wave spends
itself fixing a phantom. Mechanics: `references/findings-and-waves.md`.

## Stage 4 — Settle the open decisions with the owner

Every access-model choice (make it private, keep a minimised public surface, drop
a route, gate a UI) is asked **per `question` tool, before the waves** — options,
recommendation first. Record each answer as a durable decision in the project's
decision log, so the waves implement a decision rather than re-litigating it.

## Stage 5 — Resolve ALL findings in waves

One wave = one coherent finding group, closed through the build/verify flow
(delegate → independently verify → commit → push per rule 7; **one commit per wave**).

- **Group by mechanism, not by file.** The same defect in four controllers is one
  wave.
- **Order: severity first, then smallest blast radius.** Critical and high before
  medium; `info` last — it names no defect. A one-line config fix before a route
  refactor.
- **A wave leaves the tree green** — tests, lint, build. It is not a branch of
  half-finished work.
- **Every wave carries its own tests** — anonymous 401/403, "the minimised
  endpoint returns exactly these fields", "the served path is gone".
- **A fix must not move a finding.** On a redo the verifier checks `fixed` /
  `open` — a fixed finding that reappears elsewhere is a **new** finding, and it
  is `open`, not `fixed`.
- **Report-only is a decision, not a default** — `AKZEPTIERT` with the owner's
  reason, or a named follow-up task. Never "left it".
- **Push per `build-verify` rule 7** (push and watch CI) — the only exception is an
  explicit manual-verification order from the owner. A push never implies a deploy:
  deployment is a separate step the project's own policy governs.

## Stage 6 — Pin it, so it cannot silently regress

Every closed finding gets **both**: a test that turns red when the defect returns
(anonymous request → 401/403, the removed route → 404, the field set asserted
exactly), and an entry in the repo's security/risk register. A closed finding
without a test is a fix that the next refactor may quietly undo.

## Stage 7 — Report

Short and evidence-based:

- what was open, with the command that showed it (and the population);
- which consumers exist — authenticated vs. genuinely public;
- what changed, per wave;
- which tests pin it;
- which gates are green and which are **not** — a blocked gate is quoted with its
  blocker output, never called green;
- remaining risks and open decisions.

Full contract: `references/findings-and-waves.md`.

## Core rules

1. The deliverable is the closed, pinned set — not the finding list.
2. Enumerate from the framework, never from memory or one grep; name the population.
3. Every finding carries a reproducing command and its output.
4. Severity is reach × impact; consumers set the impact.
5. The false-positive gate runs before the first wave; a failed finding is retracted openly.
6. Group waves by mechanism; order by severity, then smallest blast radius.
7. Each wave leaves the tree green and carries its own tests.
8. Pin every closed finding with a test **and** a risk-register entry.
9. Never print a secret; push per `build-verify` rule 7 (skip only on a manual-verification order); a push never implies a deploy.

## Reference files

- `references/enumeration.md` — the per-surface recipes (routes, config exposure,
  secrets, authz, consumers).
- `references/findings-and-waves.md` — severity taxonomy, false-positive gate,
  wave planning and order, the per-wave loop, the report contract.
- `templates/laravel-route-audit.php` — project-neutral skeleton: enumerate Laravel
  routes with middleware and print the ones without auth.
