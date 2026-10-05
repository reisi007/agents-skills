# Backend conventions

Proven in `open-accreditation/backend` and `portal.reisinger.pictures/backend`
(Laravel 13, PHP `^8.5`). Paths below are relative to `backend/`.

## Layering

| Layer | Location | Rule |
|---|---|---|
| HTTP in | `app/Http/Controllers/Api/` | thin: validate → authorize → delegate to service/job |
| Validation | `app/Http/Requests/` (portal) or controller `rules()` (open-acc) | one FormRequest per write endpoint for non-trivial input |
| Custom rules | `app/Rules/` (e.g. `ValidUtf8.php`) | reusable single-check classes |
| Output shape | `app/Http/Resources/` | API response shape, never raw models |
| Domain logic | `app/Services/` | all business logic; controllers stay thin |
| Async/scheduled | `app/Jobs/`, `app/Console/Commands/`, `routes/console.php` | retries/backoff on the job, `withoutOverlapping()` on schedules |
| Authorization | `app/Policies/`, `config/permissions.php`, route `can:` middleware | gates named by capability (`mails.dlq.manage`, `teams.manage`) |
| Shared primitives | `app/Support/`, `app/Enums/`, `app/Casts/`, `app/Values/` | enums for closed sets, never free strings |

## Auth (JWT httpOnly cookie)

- Package: `php-open-source-saver/jwt-auth`. The token travels exclusively as an
  httpOnly cookie — no `Authorization` header handling, no `localStorage`.
- Cookie name and flags from `config/jwt.php` (`cookie_key_name`,
  `cross_site_cookie`, `secure`, `SameSite`). `JWT_CROSS_SITE_COOKIE=true` is
  refused in plain-HTTP environments: `SameSite=None` requires `Secure`, and
  browsers drop a `Secure` cookie on `http://` — fail closed, do not emit a
  cookie no client would accept.
- The JWT carries no tenant claim (open-acc: `getJWTCustomClaims()` is empty).
  Tenant/brand membership is resolved server-side per request (middleware +
  context singleton, e.g. `MandantContext` / `BrandRegistry`), because a
  claim minted on one tenant would otherwise be replayable on another, and a
  claim goes stale for `JWT_TTL` after membership changes.
- Routes group by capability: `Route::prefix(...)->middleware('can:...')`.
  Cross-tenant access returns 404 (not 403) to avoid leaking existence.
- Test helper on base `TestCase`: `withJwtCookie($token)` is the only channel
  that attaches auth to a test request. Open-acc additionally runs a strict-mode
  suite (`JWT_AUTH_STATE_STRICT=1`) that empties the in-memory token before each
  request, proving every test authenticates over the wire — see `references/testing.md`.

## Queues (already there — use them, do not rebuild them)

- The default `create_jobs_table` migration provides `jobs` (with `attempts`,
  `available_at`, `reserved_at` — capping and backoff built in) and `failed_jobs`;
  `config/queue.php` already points `failed` at `failed_jobs`. Do not add a
  second outbox table next to them.
- Contract: `ShouldQueue` + `dispatch()`, `public int $tries` + `backoff()` on the
  job, `after_commit => true` on the database connection (mail only sends after
  the surrounding transaction commits), dead letters via `failed_jobs` +
  `queue:failed`, manual requeue via `queue:retry`, worker via
  `queue:work --tries=N`, scheduler via `schedule:run` (60 s tick) / `schedule:work`.
- `--tries` on the CLI is the floor for jobs without their own cap, not the
  ceiling: a job with its own `$tries` wins over the CLI number.
- Operation is supervisor-owned, not code-owned: prod starts worker + scheduler
  from a supervisor script and gates the app on migration success
  (`migrate --force` → seed-if-fresh → worker/scheduler/FPM, app requires the
  migrate step to succeed). The test suite and CI pin `QUEUE_CONNECTION=sync`
  deliberately — no real worker in CI, so mail-dependent specs have no timing
  dependency; the queue contract (tries/backoff/dead-letter) is PHPUnit's job
  with a real `database` connection.
- Scheduler + cache coupling: `withoutOverlapping()` locks and any idempotency
  claim must live in a shared store (`database`/`redis`), never `array` — with
  `array` the claim is process-local while sender and worker are different
  processes, causing silent double delivery with a healthy-looking deployment.

## Validation details

- FormRequest pattern (portal): `app/Http/Requests/StoreXRequest.php` with
  `authorize()` (gate check) + `rules()`. One class per write endpoint; update
  requests are separate classes (`UpdateXRequest`), not flags on the store one.
- Controller `rules()` pattern (open-acc, e.g. `BadgeTemplateController::rules()`):
  acceptable for simple shapes — `$request->validate($this->rules())`.
- Money: one unit per field across the whole backend. Portal documents the unit
  rule centrally (`features/tech/02-backend-architecture.md` §4); a migration
  writing euros into a cents field broke checkout with 422 — units are a
  contract, not a comment.
- Seeder authority: declare which keys the seeder owns (`upsert` overwrites) vs.
  creates-only-if-missing (`insertOrIgnore`/`firstOrCreate`). Portal's
  `DatabaseSeeder` is authoritative for its 28 `settings` keys — a production
  `db:seed` overwrites UI-changed values for those keys by design. Container
  startup must use a seed-if-fresh guard (empty `users` table = fresh install),
  never an unconditional `db:seed`, or every restart clobbers production values.

## Config discipline

- One file per concern in `config/` (`jwt.php`, `mandants.php`, `permissions.php`,
  `scout.php`, …), every value `env()`-backed with a safe default.
- `phpunit.xml` pins every env key the suite depends on (see `references/testing.md`);
  unpinned `config/` keys keep reading the developer's `.env` by design — pin
  only what the suite asserts, and guard the pins with a hermeticity test.
