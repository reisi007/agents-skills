---
name: Playwright Parallel
description: 'TRIGGER when a Playwright E2E suite is slower or more fragile than it should be — CI pins --workers=1, workers: 1, a serial suite, flaky tests that only fail in CI, a matrix with shards where some entries are serial, copied projects entries as a parallelisation hack, or duplicated serial runs of the same spec. Also TRIGGER when diagnosing 429/403 throttling in E2E, when a declared lock appears to do nothing, or when deciding how many workers a runner may actually have.'
---

# Playwright parallel — named locks instead of serial runs

**Requirement: `@playwright/test >= 1.63.0`.** That is where `lock:` exists —
[release notes](https://playwright.dev/docs/release-notes). Everything below assumes it.

**Rule: no serial runs.** `--workers=1`, `mode: 'serial'`, and serial matrix entries are
forbidden as a substitute for not declaring the conflict. The conflict is declared as a
named lock; the parallelism stays.

**The only permitted exception is a *measured* quota:** a measured rate against a measured
budget, cited as `file:line`. Never an assumption. An unmeasured exception becomes the rule,
and gets configured away with `retries` later — which is exactly how a gate goes blind.

This file is the procedure. Justifications and repository evidence: [`references/notes.md`](references/notes.md).

## Diagnose first: name the symptom before touching `workers`

| Symptom | Cause | Tool |
|---|---|---|
| Suite runs `--workers=1` because two specs collide | shared state (mutex) | lock, or per-worker isolation — **not** less parallelism |
| Same failure N times, CI only, `429`/`403` in the log | quota per unit of time (rate) | dedicated throttle key, headroom in the test profile, fewer workers — **no** lock |
| Sharded matrix, some entries serial, same specs run twice | locks did not exist yet | one run, `--workers`, lock on the colliding specs |
| First attempt fails, retry goes green | flake, cause unknown | run `retries: 0`, measure the failure rate, **then** name the cause |

**Measure the failure rate before naming the cause.** At `retries: 2` you search a dataset in which failures show up as green.

## The lock in five lines

```ts
test('update user settings', { lock: 'user-settings' }, async ({ page }) => {
  // never runs at the same time as other tests holding 'user-settings'
});
```

Locks hold **across files, worker processes, and projects**. Several per test (`lock:
['database', 'external-api']`), also on `test.describe()`. Playwright acquires **all** of a
test's locks before starting, releases them at the end. ([Test locks](https://playwright.dev/docs/test-parallel).)

Why a lock can look like a dead option:

> In the default and serial modes, all tests in a file run together in order, so a
> lock declared on any test is held for the duration of the whole file.
> — [playwright.dev/docs/test-parallel](https://playwright.dev/docs/test-parallel)

**Locks only pay off with `fullyParallel: true`** — globally, per project, or via
`test.describe.configure({ mode: 'parallel' })`. Without it one lock serialises the
**whole file**, and the file was already the smallest unit of parallelism.

## Lock vs. rate limiter

**A lock is a mutex, not a rate limiter.** A lock serialises; it does not throttle. If the symptom
is a quota per unit of time, a lock does not fix it — the sequential lane reaches the same requests-per-minute, only slower.

| | Mutex — "never at the same time" | Rate — "not more than X per minute" |
|---|---|---|
| What collides | two tests write the same row / record / settings slot | an endpoint with a quota: login, API credential, external service |
| How it shows in CI | sporadic, order-dependent, foreign data from a neighbour test | a **cluster of identical failures** with status `429`/`403` |
| The right fix | lock on the test(s), or `TEST_WORKER_INDEX` isolation | throttle key **per worker/test actor**, headroom in the test profile, or fewer workers |

For **rate**: a counter keyed per IP or per global key must be split **per actor** in tests — otherwise
all workers share one bucket. Hosted-runner jobs share the provider's address space; no worker count changes that.

## Worker budget

Worker count is a function of CPU count, and CPU count depends on repo visibility:
[GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
Visibility decides the CPUs, so measure instead of assuming — in the container the run actually executes in: `nproc`.

`workers` != `nproc` because a worker is not a core (Chromium is multi-process; ~1–1.5 cores per
worker is an order of magnitude, not a Playwright statement), and because runner, backend, preview, and DB share the same cores.

**Starting values** (not truth — measuring wins): 4 cores → `--workers=2`; two-core runners → 1–2.
**Scale up only with measured suite time and a green rate**, one step at a time.

## Per-worker isolation instead of project duplicates

Isolation beats a lock wherever possible: it prevents the collision instead of serialising it.
Each worker has `testInfo.workerIndex` (from 1) and `process.env.TEST_WORKER_INDEX` (`process.env.TEST_PARALLEL_INDEX` for the parallel index).

```ts
export const test = baseTest.extend<{}, { dbUserName: string }>({
  dbUserName: [async ({ }, use) => {
    const userName = `user-${test.info().workerIndex}`;
    await createUserInTestDatabase(userName);
    await use(userName);
    await deleteUserFromTestDatabase(userName);
  }, { scope: 'worker' }],
});
```

| What collides | Pattern |
|---|---|
| Record per worker (login user, own tenant) | `user-${test.info().workerIndex}`, fixture with `scope: 'worker'` |
| Record per test | `order-${testInfo.testId}` |
| File per test | `testInfo.outputPath('export.csv')` instead of a fixed path |

## Migration: from `workers=1` to locks (order **is** the difference between "fixed" and "moved")

1. Freeze the serial baseline: duration and failure rate at `retries: 0`. No baseline, no claim.
2. Set `fullyParallel: true`. Without this step everything below is inert.
3. Run parallel, still without a lock, at `retries: 0` / `maxFailures: 0` on the budget starting value. The one measurement that shows which tests really collide.
4. Classify the failure rate. `429`/`403` → rate. Foreign data, order dependence → mutex.
5. Only now fix: mutex → lock or worker isolation; rate → per-actor throttle key, headroom, or fewer workers.
6. Scale up against the step-1 suite time; every step stays green **at `retries: 0`**.
7. Turn retries back up last — in the forgiving profile, not the strict one.

| Before | After |
|---|---|
| `workers: 1` because two specs collide | `fullyParallel: true` + lock on exactly those tests |
| N copied `projects:` entries for N parallel instances | one project, `workers`/`--workers` for parallelism |
| A `--workers=1` matrix entry for N specs, `--grep-invert` elsewhere | one run, lock on the N specs |
| `retries: 2` as a supposed fix for "flaky" | named cause (mutex or rate) + lock or throttle key |

## Sharding vs. workers

| | `--workers=N` | `--shard=x/y` |
|---|---|---|
| What | parallelism **on one instance** | distribution **across instances**/jobs |
| Granularity | files, or tests with `fullyParallel` | files without `fullyParallel`, tests with it |

With 4 cores you need `workers` plus locks, not a shard matrix. Shards do **not** balance by runtime —
durations are known only after the run. Merged reports: `reporter: 'blob'` per shard, then `npx playwright merge-reports`.
([test-sharding](https://playwright.dev/docs/test-sharding).)

## Mechanisms worth knowing (no versions — read your installed [release notes](https://playwright.dev/docs/release-notes))

- `retryStrategy: 'isolated'` — retries run at the end, sequentially, in one worker; they stop disturbing the suite.
- `testProject.workers` — per-project limit; global `testConfig.workers` stays the ceiling.
- `failOnFlakyTests` — CI gate red on **every** flake. `webServer.wait` with a named capture group — regex on stdout/stderr, group becomes an env var for `baseURL`.
- Trace-timeline reporter (one lane per worker) — make parallelism overhead visible **before** turning `workers` up.

## Traps

| Trap | What actually happens | Instead |
|---|---|---|
| Lock without `fullyParallel` | the lock is held **for the whole file** (doc note above) | `fullyParallel: true`, globally, per project, or per describe |
| Mutex symptom that was really rate | the lane runs serially, the rate stays, the suite only gets slower | classify first, then fix |
| IP-based throttle via worker count | hosted runners share IPs → every IP counter is global in CI | throttle key **per worker/test actor**, or fewer workers |
| Shards as load balancing | without `fullyParallel`, **files** are distributed, not runtime | small even files, or `fullyParallel` for test granularity |
| `retries: 2` in a flake-finding gate | the first failure vanishes into the retry; the gate **sees** nothing | strict profile `retries: 0` permanently, forgiving profile beside it |

Screenshot harness and artifact layout (including `outputDir` handling) are owned by
`ui-review` — see its harness reference.
