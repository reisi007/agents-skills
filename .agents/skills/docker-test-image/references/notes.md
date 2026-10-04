# Docker Test Image — evidence, sources, divergences

Not loaded, only read when someone asks for the **why** or the **evidence**.
The procedure itself is in [`../SKILL.md`](../SKILL.md). Everything here is the
reasoning behind a decision made there — rules standing here do not apply without
their counterpart there.

All evidence is `path:line` in a versioned repo. Line numbers in **lockfiles**
(`pnpm-lock.yaml`) are deliberately omitted — the next bump shifts them; a `sed`
rule does not survive that.

Package visibility and pull authorisation moved out of this skill: evidence for
`unauthorized` / exit 125 / the missing steps lives in the `ghcr-visibility`
skill (`../../ghcr-visibility/references/notes.md` — relative to this file).

## Sources

| Source | What it evidences |
|---|---|
| [Playwright — Docker](https://playwright.dev/docs/docker) | Demarcation: `/ms-playwright` is **our** convention, not the Playwright images'. Nothing is claimed here about those images' content or base OS |
| [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) | Runner class is a factor of pull time (CPU/net). As a **factor**, not a number — no repo document states a concrete duration |
| [GitHub — container jobs](https://docs.github.com/en/actions/using-jobs/running-jobs-in-a-container) | `container:` at job level is pulled by the runner **before** the first step, anonymously, without a `packages` scope |

Everything else in `SKILL.md` is read from the two reference repos, not measured
from here.

## The chain, as a diagram

The flow `SKILL.md` ("The chain") shows as a table. Two images, one direction —
the job runs **entirely inside the test image**:

```
  deployment/Dockerfile ──push(main) + nightly──▶ base-image.yml
                                                    │
                                    ghcr.io/<base>:<runtime-tag>   ← nightly rotates the digest
     deployment/Dockerfile.e2e ──paths + weekly──▶ e2e-image.yml
                                                    │  resolves the tag → sha256:<index-digest>
             FROM --platform=linux/amd64 ${BASE_REF} ◀─────┘  (at build time, in the workflow)
                                                    │
                      ghcr.io/<e2e>:latest | :<playwright-version> | :<playwright>-<run_number>
                                                    │
                                ci.yml, job `e2e`  container: <image>  ▼
        Baked: PHP runtime, Composer, Node, pnpm, Chromium + apt deps, /ms-playwright
        Per commit in the job: checkout → composer install → pnpm install --frozen-lockfile
```

## The build workflow in full

The flow `SKILL.md` §2 shows as a form. From
`open-accreditation/.github/workflows/e2e-image.yml`, with the comments that carry
the **why**. All evidence in this section is lines of **that same** file.

The publish step (`:168-196`) sets the job output `image_ref` to
`<image>@<digest>` and writes the same information into the step summary — that is
also where it states that `composer:2` and the `latest-v<major>.x` directory drift
independently of the repo state. Hence `image_ref` is the reference for a stable
run and `:latest` the one for a convenient run.

```yaml
on:
  push:
    branches: [ "main" ]
    paths:
      - 'deployment/Dockerfile.e2e'
      - '.github/workflows/e2e-image.yml'
      - 'frontend/pnpm-lock.yaml'
  schedule:
    - cron: '0 2 * * 1'
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7   # major tag pin

      - name: Extract build args from repository
        id: versions
        run: |
          # Exact resolved version from the lockfile — package.json may
          # carry a caret range, which is only the lower bound.
          PLAYWRIGHT_VERSION="$(sed -n "s/.*'@playwright\/test@\([0-9][0-9.]*\)':.*/\1/p" frontend/pnpm-lock.yaml | head -n1)"
          PNPM_VERSION="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"pnpm@\([0-9][0-9.]*\)".*/\1/p' frontend/package.json | head -n1)"
          [ -n "$PLAYWRIGHT_VERSION" ] || { echo "::error::…"; exit 1; }
          [ -n "$PNPM_VERSION" ]       || { echo "::error::…"; exit 1; }
          echo "playwright_version=${PLAYWRIGHT_VERSION}" >> "$GITHUB_OUTPUT"
          echo "pnpm_version=${PNPM_VERSION}" >> "$GITHUB_OUTPUT"

      - name: Resolve base image reference (digest pass-through)
        id: base
        run: |
          ref="$BASE_TAG"
          digest="$(docker buildx imagetools inspect "$BASE_TAG" \
            --format '{{.Manifest.Digest}}' 2>/dev/null || true)"
          case "$digest" in
            sha256:*) ref="${BASE_IMAGE}@${digest}" ;;
            *) echo "::warning title=…::built against the MOVING tag" ;;
          esac
          echo "base_ref=${ref}" >> "$GITHUB_OUTPUT"
```

The `cron` value is the example value from this repo (Mon 02:00 UTC). The weekday
is a project decision — the evidence in `:25-34` is that `schedule:` **and**
`workflow_dispatch:` are added, not which time.

The workflow does **not** trigger on `base-image.yml`, and the reason is in the
header comment (`:20-24`): after a nightly base rebuild the E2E CI runs on the
older E2E image until the next weekly run.

The login stands **before** the resolution (`:65-84`): resolution goes through the
registry and should succeed even if the package is ever not public — the login is
already in place then.

The rationale for resolving the digest **here** rather than as a job output of
`base-image.yml` is in the repo itself (`:86-101`): a push sets tag and digest, the
two cannot drift apart by construction; a cross-workflow output would only work via
`workflow_run` + artifact download, which does not fire on the E2E trigger paths
and would be an extra race.

The `build-args` block deliberately carries **no** `#` comment — it is parsed
linewise as `--build-arg`, so a `#` becomes a (worthless) build arg (`:128-130`).

The tag schema in detail (`:137-166`):

| Tag | Kind |
|---|---|
| `:latest` | **moving** — the CI reference tag consumed by `ci.yml` |
| `:<playwright-version>` | **moving** — the weekly cron rebuilds the same version and overwrites it |
| `:<playwright-version>-<run_number>` | immutable |
| `<image>@<digest>` (job output `image_ref`) | immutable — the reference for a stable, auditable run |

## Evidence `path:line`

### `open-accreditation`

All paths relative to the repo root.

| Statement in `SKILL.md` | Evidence |
|---|---|
| Invariant "environment only" | `deployment/Dockerfile.e2e:56-59` |
| `ARG BASE_REF` before `FROM` | `deployment/Dockerfile.e2e:61-65` |
| `--platform` required | `deployment/Dockerfile.e2e:66-78` |
| Repeat `ARG` after `FROM` | `deployment/Dockerfile.e2e:80-85` |
| `base.name` + `base.platform` | `deployment/Dockerfile.e2e:90-91` |
| `USER root` / base ends `www-data` | `deployment/Dockerfile.e2e:93-100`; `deployment/Dockerfile:264` |
| Playwright browser bound to exact version | `deployment/Dockerfile.e2e:106-110` |
| `PLAYWRIGHT_BROWSERS_PATH` | `deployment/Dockerfile.e2e:115-117` |
| Composer major tag as open point CC-R4 | `deployment/Dockerfile.e2e:119-134` |
| Node tarball verification | `deployment/Dockerfile.e2e:154-167` |
| Postcondition `ls -1 /ms-playwright` | `deployment/Dockerfile.e2e:175-176` |
| No automatic rebuild on base rotation | `deployment/Dockerfile.e2e:40-48`; `.github/workflows/e2e-image.yml:20-24` |
| Rebuild workflow trigger set | `.github/workflows/e2e-image.yml:25-34` |
| Lockfile as version source | `.github/workflows/e2e-image.yml:56-58` |
| `exit 1` on empty result | `.github/workflows/e2e-image.yml:60-61` |
| Login before digest resolution | `.github/workflows/e2e-image.yml:65-84` |
| Digest resolution, fallback with warning | `.github/workflows/e2e-image.yml:75-115`, `:98-113`, `:111` |
| Build-push, `build-args`, cache, tag schema | `.github/workflows/e2e-image.yml:117-166`, `:135-136` |
| Version tag is moving | `.github/workflows/e2e-image.yml:141-149` |
| Publish immutable reference | `.github/workflows/e2e-image.yml:168-196` |
| Base triggers (nightly, dispatch) | `.github/workflows/base-image.yml:27-35` |
| Digest pass-through for consumers | `.github/workflows/base-image.yml:19-26` |
| Job-level `container:` | `.github/workflows/ci.yml:480-491`, `:491` |
| Fork PR and `packages` scope | `.github/workflows/ci.yml:467-471` |
| Dependency install in the job | `.github/workflows/ci.yml:549-556`, `:682-683` |
| No-op fallback covers up the cause | `.github/workflows/ci.yml:684-691` |
| Two suite profiles, **no** matrix | `.github/workflows/ci.yml:440-465` (states explicitly why `matrix` is unavailable in a job `if`) |
| Measurement "net ±0 wall-clock" | `features/05-e2e-test-image.md:17-27` |
| Prod-runtime parity | `features/05-e2e-test-image.md:28-31` |
| Stable browser version | `features/05-e2e-test-image.md:34-36` |
| Network-workload ratio | `features/05-e2e-test-image.md:37-38` |
| Coupon 2 | `features/05-e2e-test-image.md:80-85` |
| Coupon 3 (wrong old claim) | `features/05-e2e-test-image.md:44-54` |
| `ENTRYPOINT` does not belong in the image | `features/05-e2e-test-image.md:248-256` |
| `docker cp` emergency path | `features/05-e2e-test-image.md:309-319` |

### `portal.reisinger.pictures`

All paths relative to the repo root. Registry-visibility evidence
(`AGENTS.todo.md:66`, `:151`, `:155`, `:156`) moved to the `ghcr-visibility`
skill and is not repeated here.

| Statement in `SKILL.md` | Evidence |
|---|---|
| Invariant "environment only" | `deployment/Dockerfile.e2e:12-16` |
| Base digest pinned in the repo | `deployment/Dockerfile.e2e:18` |
| Node: fixed version + SHA + version postcondition | `deployment/Dockerfile.e2e:52-61` |
| Composer digest-pinned | `deployment/Dockerfile.e2e:40` |
| Final identity `www-data` | `deployment/Dockerfile.e2e:72` |
| Rebuild order with pinned base | `features/infrastructure/28-ci-test-image.md:43-49` |
| Namespace invariant | `features/infrastructure/28-ci-test-image.md:36-42` |
| Rebuild workflow trigger set | `.github/workflows/e2e-image.yml:14-23` |
| `^`-tolerant regex on `package.json` | `.github/workflows/e2e-image.yml:41` |
| Checked **published** artifact | `.github/workflows/ci.yml:43-50`; `tests/infrastructure/verify-image-nonroot.sh` |
| Fork gate | `.github/workflows/ci.yml:233` |
| Manually entered image digest | `.github/workflows/ci.yml:242` |
| Matrix across desktop/mobile plus serial entry | `.github/workflows/ci.yml:245-264` |

## Divergence: where the two projects part ways

Where they differ, that is **no** house rule of this skill. The "Consequence"
column states what follows — decision, rule, open question. Inventing a position
is forbidden.

| Point | `open-accreditation` | `portal.reisinger.pictures` | Consequence |
|---|---|---|---|
| **Base pin** | resolves the digest at build time from the registry (`ARG BASE_REF`, `Dockerfile.e2e:61-91`; `e2e-image.yml:75-115`) | pins the digest in the repo (`Dockerfile.e2e:18`) | **Decision: build time.** Portal is a real existing counter-position — but it creates an ordering obligation: with a fixed base digest the base run must have run first, else the E2E build inherits old layers (`28-ci-test-image.md:43-49`) |
| **Version source** | reads the lockfile (`e2e-image.yml:56-58`) | reads `package.json` with a `^`-tolerant regex (`e2e-image.yml:41`) | **Decision: lockfile.** The point is the **resolution**, not the path — both files carry `@playwright/test`, only one carries the resolved version |
| **`--platform`** | present, reproduced locally (`Dockerfile.e2e:66-78`) | **not** present (`Dockerfile.e2e:18`, `e2e-image.yml:64`) | **Rule for the mechanism** (measured: the error exists, see failure mode 2) + **open question**: whether portal hits the same error is **not measured** and not claimed here |
| **Provenance label** | `base.name` + `base.platform` (`Dockerfile.e2e:90-91`) | none at all | **Decision with reservation:** `base.name` is OCI convention, `base.platform` is **our** convention and not standardised |
| **Immutable reference** | publish step + `image_ref` output + run-number tag (`e2e-image.yml:137-196`) | only `:latest` / `:<version>` and a **manually** entered digest in `ci.yml:242` | **Decision: publish step** (else the immutable reference is manual work). **Open question:** how the manual digest is updated after a rebuild cannot be derived from the files read — do not invent it |
| **Composer source** | moving major tag, open as CC-R4 with full reasoning (`Dockerfile.e2e:119-134`) | digest-pinned (`Dockerfile.e2e:40`) | **Open question, no house rule.** Both positions have an evidenced reason; it is not decidable without a rotation-free source of truth — the comment in OA says exactly that |
| **Node binary** | moving directory + verification against the checksums (`Dockerfile.e2e:154-167`) | fixed version + SHA + version postcondition (`Dockerfile.e2e:52-61`) | **Two stages, no variant ranking.** Both verify integrity before unpacking; only the source moves. Whoever picks one should be able to name the other as the reason |
| **Final identity** | stays `root` (`Dockerfile.e2e:93-100`) | ends with `USER www-data` (`Dockerfile.e2e:72`) | **No statement.** The job determines the user, not the image — same for an `ENTRYPOINT` (`features/05-e2e-test-image.md:248-256`) |
| **CI reference** | `:latest` (`ci.yml:491`) | digest pin (`ci.yml:242`) | **Project-dependent.** The skill only says what the tags do **not** deliver (coupon 3), not which tag schema applies |
| **Job shape** | two suite profiles, **one** job without `matrix` (`ci.yml:440-465` — states explicitly why `matrix` is unavailable in a job `if`) | matrix across desktop/mobile plus a serial entry (`ci.yml:245-264`) | **Discovery path instead of house rule:** count the entries yourself — `gh run view <id> --json jobs --jq '.jobs[].name'`. That is the factor savings scale with; a number from this file would be wrong after the next sharding |
| **Checked artifact** | absent | `verify-image-nonroot.sh` checks the **published** image anonymously (`ci.yml:43-50`) | **Open question, no claim.** A source-only `USER` check proves nothing (as the comment there states) — but only **one** repo implements this, so it is not made a requirement here |
| **Trigger set** | identical | identical | `push` on `paths` (Dockerfile + workflow + lockfile), weekly `schedule:`, `workflow_dispatch:` (`e2e-image.yml:25-34` resp. `:14-23`). The **only** point on which both agree without contradiction |

## Not evidenced / deliberately open

- **The wall-clock numbers.** They are in
  `open-accreditation/features/05-e2e-test-image.md:17-27`, measured on a suite
  explicitly described as small there. They are **not** transferable to another
  project and appear in this skill only as formula + reference. `portal` has **no**
  measurement of its own — none is claimed for it here.
- **Whether portal hits the same `--platform` error.** The mechanism is reproduced
  locally in OA; in portal it has **not** been triggered. Guesswork is not evidence.
- **How portal maintains the manual image digest.** `ci.yml:242` carries a fixed
  digest; no flow replacing it after a rebuild is described in any file read. Do
  not invent it; ask the project.
- **The absolute image pull on shared runners.** The "pull vs. install" statement
  is a ratio from one measurement in OA, not a statement about a foreign registry
  and not a number across runner classes.
- **A green run after this revision.** This skill was created by reading files in
  three repos. Nothing was built, no `git` command issued, no CI run driven.
