---
name: Laravel
description: 'TRIGGER when working in a Laravel PHP backend (Laravel 11+, PHP 8.4+, JWT-cookie auth, FormRequest validation, PHPUnit Feature/Unit suites, paratest, Pint) — or when starting one: project structure, testing policy, migration + seed policy, auth pattern, quality gates, PostgreSQL standard, and opt-in Meilisearch via Scout.'
---

# Laravel — backend conventions

Distilled from two production backends (`open-accreditation`, `portal.reisinger.pictures`):
Laravel 13, PHP `^8.5`, `php-open-source-saver/jwt-auth` over an httpOnly cookie,
PHPUnit 13 suites (`Unit` + `Feature`), `brianium/paratest`, `laravel/pint`.
Details and file evidence: `references/`.

## Structure

Standard Laravel layout. Domain code lives in `app/` by layer, not by feature:

- `app/Http/Controllers/Api/` — thin controllers (validate, authorize, delegate).
- `app/Http/Requests/` — one `FormRequest` per write endpoint (`authorize()` + `rules()`).
- `app/Http/Middleware/`, `app/Http/Resources/` — request pipeline, API output shape.
- `app/Models/`, `app/Services/`, `app/Jobs/`, `app/Policies/`, `app/Rules/`, `app/Enums/`.
- `routes/api.php` (+ `routes/console.php` for scheduled commands), `config/` per concern.
- `database/migrations/`, `database/factories/`, `database/seeders/`.

Business logic belongs in services/jobs, never in controllers or models.
New cross-cutting config gets its own `config/*.php` file, not an appendage to `app.php`.

## Testing

- `phpunit.xml` pins the hermetic baseline: `APP_ENV=testing`, `BCRYPT_ROUNDS=4`,
  `CACHE_STORE=array`, `SESSION_DRIVER=array`, `QUEUE_CONNECTION=sync`,
  `MAIL_MAILER=array`, `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`.
- `tests/Unit` for pure logic, `tests/Feature` for HTTP/DB behaviour with
  `RefreshDatabase`. Factories build fixtures; seeders do not run in tests.
- Canonical commands: `php artisan test` (full suite), `php artisan test --filter <Class>`
  (scoped). `php artisan test --parallel` (paratest) works out of the box — every
  worker gets its own isolated `:memory:` DB, no worker-DB setup needed.
- Full suite runs in ONE agent at a time for reproducibility; scoped `--filter`
  runs with disjoint classes may run alongside. Never run two full suites concurrently.
- File tests: fake every local disk in `setUp()` (`Storage::fake()` on all local disks)
  and clean up in `tearDown()` — a test that forgets `fake()` writes into the
  developer's real `storage/app/**`. Never delete `storage/app/**`.
- Testing reference (strict-mode auth measurement, residue guards, mail faking):
  [`references/testing.md`](references/testing.md).

## Migration + seed policy

- Deployed migrations are immutable. Every schema change after first shared use
  gets its own new migration (Laravel timestamp naming). `down()` methods are
  never executed — leave them empty.
- After EVERY `migrate` / `migrate:fresh`, run `db:seed` (or `--seed`): without
  the seed there is no admin user and login/auth is dead. The seeder creates the
  admin via `firstOrCreate` from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Keep migrations portable (no DB-specific SQL, `json` type instead of `jsonb`,
  date arithmetic via query builder). Full policy: [`references/database.md`](references/database.md).

## Validation

- Write endpoints validate via `FormRequest` (`authorize()` + `rules()`); simple
  cases may use `$request->validate($this->rules())` with a private `rules()`
  method on the controller. Custom reusable checks go in `app/Rules/`.
- Money fields: single unit per field, documented once (cents vs. euros decided
  per project — never mixed). Enum-like inputs use native PHP enums with a
  validation rule, not free strings.

## Auth

- JWT in an httpOnly cookie (`php-open-source-saver/jwt-auth`), never in
  `localStorage`. Cookie name/flags come from `config/jwt.php` (`secure`,
  `SameSite`); cross-site cookies require HTTPS (`SameSite=None` needs `Secure`).
- Authorization via gates/policies enforced as route middleware (`can:...`) or
  `$this->authorize(...)` in controllers — never trust a client-supplied tenant
  or role claim. Multi-tenant scoping is resolved server-side per request.
- Tests authenticate with a `withJwtCookie($token)` helper on the base `TestCase`.
  Patterns: [`references/backend-conventions.md`](references/backend-conventions.md).

## Quality gates (all must pass before commit)

```bash
cd backend && ./vendor/bin/pint --test   # formatting gate (CI fails on violations)
cd backend && php artisan test           # full suite; --parallel where safe
```

Fix formatting with `./vendor/bin/pint` (it is the auto-fix — never hand-format
around it). PHP requirement (`composer.json` `php` field, enforced by
`vendor/composer/platform_check.php`): check `php -v` first — a wrong PHP looks
like a dependency failure (`Composer detected issues in your platform`).

## Database — PostgreSQL is the standard

- Dev/Prod: **PostgreSQL**. Tests: **SQLite `:memory:`**. A file-backed SQLite DB
  is acceptable for throwaway local dev only.
- **MySQL is deprecated — never use it for new work.** `config/database.php` may
  still contain a legacy `mysql` connection; do not point anything new at it.
- Portability rule: schema and queries must run on both Postgres and SQLite
  (details: [`references/database.md`](references/database.md)).

## Search — opt-in Meilisearch via Scout (off by default)

Without `laravel/scout` there is no search infrastructure — plain
`where`/`LIKE` queries are the default. When full-text search is needed:

- Packages: `laravel/scout` + `meilisearch/meilisearch-php`. `SCOUT_DRIVER=meilisearch`,
  `MEILISEARCH_HOST`/`MEILISEARCH_KEY` via env. Index settings (searchable,
  filterable, sortable attributes, typo tolerance) live in `config/scout.php`.
- Models use `Searchable` + `toSearchableArray()` (whitelist fields — never index
  secrets); `shouldBeSearchable()` excludes rows that must stay unindexed.
- Rebuild command (`scout:flush` → `scout:sync-index-settings` → `scout:import`
  per model). Search tests flush + sync settings in `setUp()` and wait for
  indexing tasks before asserting.
- Full setup, testing, and what-changes checklist: [`references/scout-meilisearch.md`](references/scout-meilisearch.md).
