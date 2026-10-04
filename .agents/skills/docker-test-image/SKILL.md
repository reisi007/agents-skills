---
name: Docker Test Image
description: 'TRIGGER when a repo bakes a container image for its E2E/CI job (Dockerfile.e2e, Test-Image, E2E-Image, CI-Image), when deciding what may go into that image, when the Playwright browser version in the image is read from package.json or pnpm-lock.yaml, when a base-image and e2e-image chain is wired (base-image, Image-Rebuild, Rebuild-Trigger), or when a base reference is pinned (Digest-Pinning, image pin, OCI base.name label, --platform). NOT for the prod base image (php-fpm/supervisor/healthcheck) and not for generic path filters. Covers: the environment-only invariant, the version from the lockfile, digest pass-through resolved at build time, the --platform and UndefinedVar traps, what the image does NOT buy (bit-reproducibility, freshness), and the checklist before the first push.'
---

# Docker Test Image — an image that bakes only the environment

**Core rule:** the test image bakes **only the environment** (runtime, toolchain,
browser) — **never** app code, `node_modules/`, `vendor/`. The Playwright browser
version comes from the **lockfile**, not from `package.json`.

Verbatim invariant in both reference repos (`deployment/Dockerfile.e2e:56-59`,
`portal/deployment/Dockerfile.e2e:12-16`) — which is why the image needs **no**
rebuild on a code change. Not in scope: the prod base image (php-fpm, supervisor,
healthcheck, entrypoint). Package visibility and pull authorisation live in the
`ghcr-visibility` skill.

**Evidence convention:** no repo prefix = `open-accreditation`, `portal/` prefix = the other repo; full paths in [`references/notes.md`](references/notes.md).

## The chain

Two images, one direction. The job runs **entirely inside the test image** — no
browser download, no apt setup per run. Diagram: [`references/notes.md`](references/notes.md).

| Block | File | Trigger (`open-accreditation`) |
|---|---|---|
| Prod runtime | `deployment/Dockerfile` | push to `main` on change to itself, `schedule:` nightly, `workflow_dispatch` (`.github/workflows/base-image.yml:27-35`) |
| **Test image** | `deployment/Dockerfile.e2e` | push to `main` on change to Dockerfile **or** workflow **or** lockfile, weekly `schedule:` (example time — the weekday is a project decision), `workflow_dispatch` (`.github/workflows/e2e-image.yml:25-34`) |
| Consumer | `ci.yml`, job `e2e` | `container:` at **job level** (`.github/workflows/ci.yml:480-491`) |

`<runtime-tag>` = the runtime tag in `FROM`: the **tag is the project contract**,
the **digest** is what stays stable across runs.

## Cost — and why it exists anyway

Measured, not a speedup (`features/05-e2e-test-image.md:17-27`): browser install
disappears per matrix entry, image pull arrives per matrix entry — **net ±0
wall-clock**. Justification: **parity > wall-clock**. It buys prod-runtime parity
(`:28-31`), a stable browser version == `@playwright/test` from the lockfile
(`:34-36`, the only determinism promise), and shifted network workload (ratio
measured `:37-38`, absolute value not).

## 1. Dockerfile skeleton

The load-bearing lines; everything else is detail.

```dockerfile
# Base ref arrives as a build arg; global ARGs are NOT in scope after FROM.
ARG BASE_REF=ghcr.io/<base>:<runtime-tag>       # local build without build-args
ARG BASE_PLATFORM=linux/amd64                   # required, not decoration
FROM --platform=${BASE_PLATFORM} ${BASE_REF}
# Provenance lives ON the artifact, not only in the CI log.
ARG BASE_REF                                    # re-declare: otherwise the LABEL
ARG BASE_PLATFORM                               # expands to EMPTY (UndefinedVar)
LABEL org.opencontainers.image.base.name="${BASE_REF}"
LABEL org.opencontainers.image.base.platform="${BASE_PLATFORM}"
# The base image runs as www-data; every install step below needs root.
USER root
# Placeholders for a local build; CI passes the resolved values.
ARG PLAYWRIGHT_VERSION=0.0.0   # placeholder: CI passes the resolved lockfile version
ARG PNPM_VERSION=0.0.0         # placeholder: CI passes package.json#packageManager
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV DEBIAN_FRONTEND=noninteractive          # playwright calls apt internally
RUN apt-get update && apt-get install -y --no-install-recommends \
        git curl xz-utils unzip zip && rm -rf /var/lib/apt/lists/*
RUN npm install -g "pnpm@${PNPM_VERSION}" && pnpm --version
RUN npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium \
    && ls -1 /ms-playwright               # postcondition: the path exists in the image
```

Why these lines (`deployment/Dockerfile.e2e`): `ARG` before `FROM` (`:61-65`);
`--platform=linux/amd64` (`:66-78`) + re-declared `ARG` after it (`:80-85`);
`USER root` — the base ends with `USER www-data` (`deployment/Dockerfile:264`);
`/ms-playwright` (`:115-117`) is **our** convention, not upstream's
(<https://playwright.dev/docs/docker>); `&& ls -1 /ms-playwright` (`:175-176`)
is the postcondition — without it a build is green with the browser missing.

**Node/Composer:** both variants defensible, neither without a comment. Portal pins
version **and** SHA-256 with a version postcondition
(`portal/deployment/Dockerfile.e2e:52-61`); open-accreditation pulls the moving
`latest-v<major>.x/` directory, verifies against shipped checksums
(`Dockerfile.e2e:154-167`), marks the moving major tag as open point CC-R4 (`:119-134`).

## 2. Build workflow

Four steps, order is contract: (1) versions from the lockfile, empty ⇒ `::error::`
+ `exit 1` (`e2e-image.yml:56-61`); (2) registry login **before** digest resolution
(`:65-84`); (3) digest pass-through at build time, fallback to the moving tag =
**warn, not red** (`:75-115`); (4) build+push, `cache-from/to: type=gha`, tags
`:latest` + `:<version>` moving, `:<version>-<run_number>` and `image_ref`
(`<image>@<digest>`) immutable (`:117-196`). Full YAML with comments:
[`references/notes.md`](references/notes.md).

**Lockfile rule:** binaries bind to the **exact** `@playwright/test` version;
`package.json`'s caret range is the lower bound, not the resolution. Lockfile in
`paths` — a dependabot bump must pull the image along. ⚠️ `node-deps` conflict,
name it in the Dockerfile: "no pins in `package.json`" holds there; the range stays
in the manifest, the **resolved** version goes into the image.

**Rebuild triggers:** `paths` on Dockerfile + workflow + lockfile, weekly
`schedule:` as freshness floor, `workflow_dispatch` for the manual case. Deliberate
gap: no trigger on `base-image.yml` (`:20-24`) — coupon 2 in
[`references/failure-modes.md`](references/failure-modes.md).

## Failure index

One line per symptom; full text in [`references/failure-modes.md`](references/failure-modes.md).

| Symptom in the log | Cause → pointer |
|---|---|
| `exit code 125`, `unauthorized`, **no steps in the log** | private package; login inside the job is impossible → `ghcr-visibility` skill |
| `pull_request` job does not run, fork PR | read-only token on forks → `ghcr-visibility` skill (`if:` gate or `public`) |
| `no match for platform in manifest: not found` | `--platform` at the `FROM` → failure mode 2 |
| `UndefinedVar`, LABEL empty | re-declare `ARG` after `FROM` → failure mode 3 |
| `Permission denied` at apt/npm/playwright, only after a base push | inherited `USER www-data` → `USER root` → failure mode 4 |
| Job green, browser version questionable | version from manifest instead of lockfile → lockfile rule, mode 5; counter-check `docker run … ls /ms-playwright` |
| `::warning title=Base not resolvable` | deliberate degrade, not red → coupon 1 |
| Green, but ancient PHP runtime | no trigger on base rebuild → `workflow_dispatch` → coupon 2 |
| `:latest` carries an unexpected version | the tag is moving, that is normal → coupon 3 |

## What the image explicitly does NOT do

- **No bit-reproducibility.** Check: **which inputs come from outside the repo,
  and is each pinned or marked moving?** The pin makes a run **auditable**, not
  reproducible. Baked binaries **must** verify against shipped checksums before
  unpacking (`sha256sum -c`, `Dockerfile.e2e:154-167`); a moving source directory
  **must** be marked moving in the Dockerfile comment.
- **No freshness without rebuild triggers** — lockfile `paths` + weekly `schedule:`.
- **No dependency install per commit** — CI runs `pnpm install --frozen-lockfile`
  and `composer install` in the job (`ci.yml:549-556`, `:682-683`).
- **No lock against registry outages** — coupon 1.

## Checklist before the first push

- [ ] Base digest nowhere in the repo — it rotates; resolution in the workflow (`Dockerfile.e2e:40-48`).
- [ ] Exactly one namespace for both image workflows, via `${{ github.repository_owner }}` (`portal/features/infrastructure/28-ci-test-image.md:36-42`).
- [ ] `ARG BASE_REF` before `FROM`, `FROM --platform=`, `ARG` re-declared after, `LABEL base.name` + `base.platform` set.
- [ ] `USER root` after `FROM` — whatever the base image currently does.
- [ ] `PLAYWRIGHT_BROWSERS_PATH` set, `install --with-deps`, `&& ls -1 /ms-playwright` as postcondition.
- [ ] Lockfile rule holds in the workflow, lockfile in `paths`, weekly `schedule:` beside it.
- [ ] GHCR package `public` before any job points `container:` at it (→ `ghcr-visibility` skill).
- [ ] Rebuild order settled: with a digest-pinned base the base run goes **first** (`portal/features/infrastructure/28-ci-test-image.md:43-49`).
- [ ] Tag schema labelled honestly: what is moving is moving.
- [ ] What the image does not guarantee is in the Dockerfile comment — not only in the feature doc.

## Cross-references

- Prod base image (php-fpm/supervisor/healthcheck/`USER www-data`): separate block, only a precondition here.
- `github-ci-filters`: why `paths` is a list, not `paths-ignore`, + the branch-protection trap.
- `node-deps`: the range rule this lockfile rule collides with.
