# Docker Test Image — failure modes and coupons

Read when a build or run fails. The one-line index lives in
[`../SKILL.md`](../SKILL.md) ("Failure index"); everything here is the full
explanation behind one row. Symptoms are **measured**, not derived — the error
strings stay verbatim so a case can be recognised in a log.

## Failure mode 2 — `no match for platform in manifest: not found`

**Symptom.** `docker buildx build` aborts with `no match for platform in manifest:
not found` — typically on an arm64 host (Apple Silicon), never on the amd64 CI
runner. Reproduced and fixed locally, not guessed (`Dockerfile.e2e:66-74`).

**Cause.** `base-image.yml` publishes with `platforms: linux/amd64`; the index
carries only an amd64 manifest. `FROM <repo>@sha256:<index-digest>` lets BuildKit
**choose** the platform from the index instead of taking one.

**Countermeasure.** `ARG BASE_PLATFORM=linux/amd64` +
`FROM --platform=${BASE_PLATFORM}` and `platforms: linux/amd64` in the build
workflow. Once the base goes multi-arch, this may become `linux/arm64` or go away.

## Failure mode 3 — empty provenance (`UndefinedVar`)

**Symptom.** BuildKit warns with `UndefinedVar`; `docker image inspect <image>`
returns an **empty** string for `org.opencontainers.image.base.name`. No error,
no red build.

**Cause.** Global `ARG`s are out of stage scope after `FROM`. Without re-declaration
`${BASE_REF}` in the LABEL expands to empty (`Dockerfile.e2e:80-83`).

**Countermeasure.** Repeat `ARG BASE_REF` / `ARG BASE_PLATFORM` immediately after
the `FROM`.

## Failure mode 4 — `Permission denied` in the E2E image build

**Symptom.** The image build aborts at `apt-get` / `npm -g` / the Playwright
install. Appears **only** after the base image was re-pushed — so the fault has
nothing to do with the test-image code.

**Cause.** The base image ends with `USER www-data`; the test image inherits the
directive (`deployment/Dockerfile:264`, `Dockerfile.e2e:93-99`).

**Countermeasure.** `USER root` directly after the `FROM` and the LABEL block.

## Failure mode 5 — the job is green and still does not test the repo

**Symptom.** **No log symptom.** The job is green but the browser version in the
image does not match `pnpm-lock.yaml`. Its manifestation: unexpected
browser-dependent failures, and the no-op fallback in `ci.yml`
(`npx playwright install chromium`, **without** `--with-deps`) re-downloads
missing browsers and **covers up** the cause in the log (`…/ci.yml:684-691`).

**Cause.** Playwright binaries are bound to the exact version. Once written as a
hard number into the Dockerfile and never pulled along afterwards
(`Dockerfile.e2e:106-110`) — or read from the manifest instead of resolved (→ the
lockfile rule in `SKILL.md` §2).

**Countermeasure.** The lockfile rule, plus the lockfile as a rebuild trigger.
**Counter-check:** `docker run --rm <image> ls -1 /ms-playwright` against the
lockfile state.

## Coupon 1 — digest not resolvable, job stays green

**Symptom.** `::warning title=Base not resolvable::` plus the line in the step
summary; the LABEL carries the **tag** instead of a digest. No error.

**Cause.** Registry outage, package not public, buildx format
(`…/e2e-image.yml:111`).

**Countermeasure.** Degrade deliberately instead of going red: the E2E image stays
functional, it only loses base provenance. Whoever does not accept that turns the
fallback into `exit 1` — but then it is also clear the job runs not only on
test-image changes but hangs off the registry.

## Coupon 2 — the image runs one generation behind

**Symptom.** CI log green, but the E2E run tests against a PHP runtime that is no
longer the one running in production. No error, no diff — just a fact nobody sees.

**Cause.** `e2e-image.yml` does not trigger on `base-image.yml`
(`…/e2e-image.yml:20-24`, `features/05-e2e-test-image.md:80-85`).

**Countermeasure.** The weekly cron is the upper bound on base drift (deliberate
trade-off, named in the Dockerfile comment). For sharper: `workflow_dispatch`
after every base rebuild — the manual part of the trigger exists for that.

## Coupon 3 — the version tag is not a pin

**Symptom.** `:<playwright-version>` is suspected of being immutable; it is not:
the weekly cron rebuilds the same Playwright version against a meanwhile updated
base and overwrites the tag (`…/e2e-image.yml:141-149`).

**Cause.** An old comment claimed the opposite
(`features/05-e2e-test-image.md:44-54`). A tag with the same version is moving by
construction.

**Countermeasure.** For a stable, auditable run take the **digest** (job output
`image_ref`) — not the version tag. `:latest` as a moving CI reference is fine as
long as nobody expects determinism from it.

## Appendix — emergency path when container mode itself jams

Fetch the browsers from the image instead of reinstalling, put the job back on the
runner (`features/05-e2e-test-image.md:309-319`). Such a fallback is an
operations/workflow change and must not silently alter the baked environment.

```bash
docker create --name pw-cache <e2e-image>
docker cp pw-cache:/ms-playwright "$HOME/ms-playwright"
docker rm pw-cache
echo "PLAYWRIGHT_BROWSERS_PATH=$HOME/ms-playwright" >> "$GITHUB_ENV"
```
