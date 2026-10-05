# Testing

Proven in both backends (PHPUnit 13, `brianium/paratest`, SQLite `:memory:`).

## Baseline (`phpunit.xml`)

Two suites — `Unit` (`tests/Unit`) and `Feature` (`tests/Feature`) — with this
pinned environment:

| Key | Value | Why |
|---|---|---|
| `APP_ENV` | `testing` | isolates env-dependent branches |
| `APP_KEY`, `JWT_SECRET` | fixed test-only values, `force="true"` | suite must not depend on the developer's `.env` |
| `BCRYPT_ROUNDS` | `4` | fast hashing |
| `CACHE_STORE` / `SESSION_DRIVER` | `array` | no shared state between tests |
| `QUEUE_CONNECTION` | `sync` | no worker in tests/CI (see queue contract below) |
| `MAIL_MAILER` | `array` | a forgotten `Mail::fake()` cannot open a socket |
| `DB_CONNECTION` / `DB_DATABASE` | `sqlite` / `:memory:` | canonical test DB (below) |
| `SCOUT_DRIVER` etc. | only when Scout is enabled | see `scout-meilisearch.md` |

Rule: pin every env key the suite asserts; guard the pins with a hermeticity
test so a stray shell export fails loudly in one place instead of silently
elsewhere. `force="true"` pins win over `.env` but lose to real shell exports
(PHPUnit writes `$_ENV`/putenv; Laravel reads `$_SERVER` first) — document that
limit, do not pretend it away.

## Canonical test DB: SQLite `:memory:`

- Tests run fully on `:memory:` — no DB container, no grants, no worker DBs.
- `RefreshDatabase` migrates the in-memory DB fresh per test class/process.
- `php artisan test` (full suite), `php artisan test --filter <Class>` (scoped).
- `php artisan test --parallel` (paratest) works out of the box: each worker
  process starts its own isolated in-memory DB. There is no shared instance that
  parallel runs could destroy each other on.
- Postgres parity is enforced by portability rules (see `database.md`), plus an
  explicit Postgres gate (`DB_HOST=dind bash scripts/test-pgsql.sh` in open-acc)
  for queries that need the real engine.

## Concurrency rule (agents)

- The full suite runs in ONE agent at a time — reproducibility, not locking.
- Scoped `--filter` runs with disjoint classes may run alongside a full suite.
- Never run two full suites in the same checkout concurrently.

## Filesystem isolation (strict)

The DB is process-isolated; the filesystem is not. Two failure modes:

1. **Cross-run residue:** fake-disk roots under `storage/framework/testing/disks/`
   are shared and gitignored. Every test's `setUp()` must fake all local disks
   (`local`, `private`, `media`, `public`); `tearDown()` empties the fake roots.
   A test without `fake()` writes into the real `storage/app/**` — the
   developer's dev media. `storage/app/**` is never deleted. Pin with a
   residue regression test (open-acc: `TestDiskIsolationTest`).
2. **Cross-process collision:** under plain `php artisan test`,
   `ParallelTesting::token()` is `false`, so concurrent runs share fake roots
   and delete each other's files mid-test. Resolve a per-process token
   (`TEST_TOKEN` prefix + PID via `ParallelTesting::resolveTokenUsing()`) in the
   base `TestCase` and clean up only own roots on shutdown — then parallel full
   runs in one checkout no longer collide. The one-agent discipline above still
   applies for reproducibility.

## Auth testing

- `withJwtCookie($token)` on the base `TestCase` is the only channel that
  attaches auth to test requests.
- Strict-mode measurement (open-acc, `JWT_AUTH_STATE_STRICT=1`): empties the
  process-global JWT singleton and guard memo before each request, so a request
  can only authenticate over the wire. Relaxed and strict runs must report the
  same failures; the single premise test proving the singleton *can* answer is
  allow-listed by name and pinned to exactly one class.

## Mail/queue testing

- Suite pins `QUEUE_CONNECTION=sync` and `MAIL_MAILER=array`. Mail-sending tests
  use `Mail::fake()`; queue-contract tests (tries/backoff/dead-letter) use the
  real `database` connection, since `sync` structurally cannot produce a
  `failed_jobs` row (only a worker writes one).
- Note Laravel's testing transaction manager hides the enclosing
  `RefreshDatabase` transaction, while `after_commit` callbacks of a real nested
  `DB::transaction()` do fire — design `after_commit` tests around a nested
  transaction, not the test case itself.
