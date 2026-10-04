---
name: GHCR Visibility
description: 'TRIGGER when a job-level `container:` pull fails, when `unauthorized` appears on a manifest, when a job dies with exit 125 before any step runs, when a container package needs to be made public, when fork PRs cannot pull an image, or when a `packages` scope appears not to help. Covers package visibility and pull authorisation on a container registry: the private-package failure, the too-late login, the PATCH-404 trap, and the fork-PR consequence.'
---

# GHCR Visibility — package visibility and pull authorisation

**Scope:** this skill is about **package visibility and pull authorisation on a
container registry**, not about building images. The build chain lives in the
`docker-test-image` skill and is not restated here.

**Core rule:** a job-level `container:` image must be pullable **anonymously** —
i.e. the package is `public` — or the job must be restructured so no anonymous
pull happens. A login step inside the job cannot fix this; it runs too late.

## Symptom

`docker: … /v2/<org>/<pkg>/manifests/sha256:…: unauthorized`, then
`##[error]Process completed with exit code 125.` The job aborts after seconds, and
**all following steps are missing from the log entirely** — no checkout, no test
error, nothing. Measured in `portal`, CI run `36168928448`, job `108183657407`
(`portal/AGENTS.todo.md:155`); the same failure class hit all E2E jobs plus the
backend job (`portal/AGENTS.todo.md:66`).

## Cause

`container:` at **job level** is pulled by the runner **before the first step
runs** — anonymously, without a `packages` scope and without a login.
Least-privilege design, not an oversight (`portal/.github/workflows/ci.yml:18-25`;
[GitHub — container jobs](https://docs.github.com/en/actions/using-jobs/running-jobs-in-a-container)).

Consequence: a `docker/login-action` **inside the job** comes too late — not an
alternative, but impossible (`portal/AGENTS.todo.md:156`).

## Fix

Set the package to `public` in the org settings and re-run the job. The
alternative is structural: pull the image in a dedicated step instead of letting
the job run in it.

**Trap:** `PATCH /orgs/<org>/packages/container/<pkg>` returns `404 Not Found`
for this token **while** `GET` returns the package, and a non-existent name yields
`{"message":"Package not found."}` ⇒ the update route is missing for this token;
it is **not** a scope problem (`portal/AGENTS.todo.md:151`). Do not chase the
`packages` scope — flip visibility in the settings UI instead.

## Fork-PR consequence

A PR from a fork gets only a read-only `GITHUB_TOKEN` ⇒ `pull_request` jobs need a
`public` package **or** an `if:` gate on
`github.event.pull_request.head.repo.full_name`
(`.github/workflows/ci.yml:467-471`; portal gates via
`pull_request … .fork == false`, `portal/…/ci.yml:233`).

## Diagnose

| Symptom in the log | Meaning |
|---|---|
| `unauthorized` on `/v2/…/manifests/…`, exit code 125, **no steps in the log** | private package pulled anonymously before the first step |
| `PATCH` on the package API → `404`, `GET` works | missing update route for the token, not a scope problem |
| `pull_request` job missing/skipped on fork PRs | read-only token — `public` package or `if:` gate needed |

Evidence and `path:line` quotes: [`references/notes.md`](references/notes.md).
