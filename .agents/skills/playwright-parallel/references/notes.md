# Playwright parallel — evidence, sources, case studies

Read on demand, when someone asks for the **why** or the **evidence**.
The procedure itself lives in [`../SKILL.md`](../SKILL.md). Everything here is
justification for a decision made there — rules stated here do not apply
without their counterpart there.

## Sources

Every version-shaped statement in `SKILL.md` resolves through the release
notes of the installed version
([release notes](https://playwright.dev/docs/release-notes)) plus these
mechanism pages:

| Source | What it substantiates |
|---|---|
| [Parallelism](https://playwright.dev/docs/test-parallel) | lock semantics across files/workers/projects, the fallgrube note, `fullyParallel`, `mode: 'parallel'`, `workerIndex`/`parallelIndex`, the `scope: 'worker'` fixture, `testInfo.testId`, `testInfo.outputPath()`, `maxFailures` |
| [Sharding](https://playwright.dev/docs/test-sharding) | granularity depends on `fullyParallel` (file vs. test level), `blob` reporter + `merge-reports` |
| [Timeouts](https://playwright.dev/docs/test-timeouts) | `globalTimeout`, per-test `timeout` (default 30 s), `--timeout` |
| [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) | runner sizing depends on repo visibility; measure `nproc` in the job |
| [Release notes 1.63](https://playwright.dev/docs/release-notes#version-163) | the minimum version this skill requires — `lock:` ships there |

**An order of magnitude, not a source:** "a worker is not a core, ~1–1.5
cores". Chromium is a multi-process browser (browser, renderer, GPU process);
the concrete cores-per-worker figure is experience, **not** a Playwright
statement. Whoever wants it substantiated measures it.

## Case 1 — `open-accreditation`: what the repo claims vs. what it measures

**Status: applies, not yet implemented.** No `lock:` in any spec or config;
`fullyParallel: true` is already set, yet the workflow switches parallelism off.

| Observation | Evidence |
|---|---|
| `fullyParallel: true` is set — the lock precondition would hold | `frontend/playwright.config.ts:24` |
| Config is generous (`workers: process.env.CI ? 4 : 8`), **and** the workflow pins `--workers=1` in all three branches | `frontend/playwright.config.ts:27`; `.github/workflows/ci.yml:759`, `:761`, `:763` |
| The documented reason for `--workers=1` is the **login throttle**, not a mutex | `.github/workflows/ci.yml:728-732` |
| The limiter is keyed **per IP** — all workers share one bucket, so splitting the work cannot relieve it, and running serially does not fix it either | `backend/app/Providers/AppServiceProvider.php:85-86` (`->by('login:'.$request->ip())`) |
| The budget is 40/min in local/testing (15/min in production) | `backend/app/Providers/AppServiceProvider.php:83` |
| The same repo measures **~17 logins/min at ~8 workers** against that 40/min budget — half the budget, which contradicts the reason given for the serial pin | `backend/app/Providers/AppServiceProvider.php:79-80` |
| `CACHE_STORE=array` removed the 429 symptom (6 measured failures, all "Admin API login failed with status 429"), **not** the shared CI IP | `.github/workflows/ci.yml:563-570` |
| The strict nightly profile forbids raising workers in its docblock already — same reasoning | `frontend/playwright.regression.config.ts:49-55` |
| The profile is trimmed for fail-detection: `retries: 0`, `maxFailures: process.env.CI ? 1 : 0` | `frontend/playwright.regression.config.ts:59`, `:62` |
| Per-worker isolation partly exists — `TEST_WORKER_INDEX` inside a fixture key | `frontend/tests/e2e/helpers/admin-data.ts:1148-1153` |
| `@playwright/test` meets the minimum version from `SKILL.md` — locks available without a bump | `frontend/package.json:51` |

Claim vs. measurement, side by side: the repo claims parallel workers share the
CI IP and produce 429s (`.github/workflows/ci.yml:728-732`); the repo measures
~17 logins/min against a 40/min budget
(`backend/app/Providers/AppServiceProvider.php:79-80`). The two disagree, and
the disagreement is **not resolvable from the files** — the plausible mechanism
is a burst from one chatty file rather than sustained concurrency, but no file
I read substantiates a per-file login count, so no number is asserted here.
The honest form of the finding stands: rate case either way, so a lock would
not fix it. Candidates, if the repo takes this on (not commissioned, recorded
only): a throttle key per worker/test actor in the E2E test profile, or
`workers: 1` as a deliberate configuration with a documented reason instead of
a pin in the workflow. The mutex part of the suite (the still-open DB-state
accumulation between specs named in the docblock) would be the actual lock
candidate.

## Case 2 — `portal.reisinger.pictures`: the pattern this skill replaces

**Status: applies, not yet implemented — an open finding, not done.**
Nothing was executed; this case is read from files only.

| Matrix entry | `--workers` | Line |
|---|---|---|
| Desktop 1/3 | 2 | `.github/workflows/ci.yml:258` |
| **Desktop 2/3** | **1** | `.github/workflows/ci.yml:259` |
| Desktop 3/3 | 2 | `.github/workflows/ci.yml:260` |
| Mobile 1/3 | 2 | `.github/workflows/ci.yml:261` |
| **Mobile 2/3** | **1** | `.github/workflows/ci.yml:262` |
| Mobile 3/3 | 2 | `.github/workflows/ci.yml:263` |
| **serial (isolated suites)** | **1** | `.github/workflows/ci.yml:264` |

- Seven entries: six sharded ones carrying the same `--grep-invert` over five
  suites, the seventh running exactly those five via `--grep`, serially. The
  same specs run as **their own matrix entry** and in the other six **not at
  all** (`.github/workflows/ci.yml:258-264`).
- The documented reason for the serial entry is a **mutex**:
  `billing-details` writes global, brand-wide bank-data settings; desktop
  **and** mobile shards run the same tests in parallel against the same DB and
  overwrite each other (`.github/workflows/ci.yml:216-221`). Exactly the case
  for a named lock.
- The board suites collide on shared board/settings state, and two of the five
  specs additionally use serial test mode (`.github/workflows/ci.yml:212-215`).
- `fullyParallel: true` is already in the config — the lock precondition would
  hold (`frontend/playwright.config.ts:9`).
- Shared IP is documented here too, this time for Cloudflare: all E2E workers
  use the same runner IP, so the IP threshold stays high
  (`.github/workflows/ci.yml:276-277`) — a **rate** case, not a mutex.
- The workflow notes itself that `--shard` distributes by file order, not
  runtime (`.github/workflows/ci.yml:255-257`), and that the chosen worker
  counts are a reduction decision for the current suite, not a guarantee
  (`.github/workflows/ci.yml:249-254`).
- `@playwright/test` is on `^1.62.1` — locks need **a bump to the minimum
  version first** (`frontend/package.json:71`).

If the repo takes this on (not commissioned): the seventh matrix entry plus the
`--grep-invert` carve-out in the other six is replaceable with a lock on the
five specs and `--workers` on all seven. The open question is the size
difference between shards (the 2/3 entry is client/checkout-heavy) — worker
count does not compensate for that; either isolation or a different split does.

## Measured incidents

- **`outputDir` wipe:** Playwright empties `outputDir` recursively before every
  run. In `open-accreditation` this deleted 60 real Design-QA screenshots of a
  run because the screenshot `outputDir` sat below the Playwright default —
  `frontend/playwright.config.ts:7-16`. Evidence that the trap is not
  theoretical. Layout ownership: `ui-review`, see its harness reference.

## Deliberately open / not substantiated

- **Whether a lock would help in either suite.** Not decidable without a
  `retries: 0` measurement and a classification of the failure rate (mutex or
  rate) — and not claimed here.
- **A green run after a migration.** Nothing was executed, nothing changed, no
  `git` command issued; this skill was built by reading files.
- **Whether `open-accreditation` raises workers in the nightly profile.** The
  repo forbids it in the docblock (`playwright.regression.config.ts:49-55`) —
  whether other means can overcome that decision is open and belongs in that
  repo's `AGENTS.todo.md`, not here.
- **Cores per worker.** See above: order of magnitude, no evidence.
