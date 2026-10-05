# Database — PostgreSQL standard, MySQL deprecated

## Engine policy

| Environment | Engine |
|---|---|
| Dev / Prod | **PostgreSQL** |
| Tests | **SQLite `:memory:`** (from `phpunit.xml`) |
| Throwaway local dev | file-backed SQLite acceptable (portal pattern: `database/database.sqlite`, gitignored) |
| New work | **never MySQL** — deprecated |

`config/database.php` in existing projects may still contain a legacy `mysql`
connection block. Leave it untouched, do not point anything new at it, remove
it only as its own migration task with prod evidence.

## Portability rule (critical)

Schema and queries must run on **both** Postgres (dev/prod) and SQLite
(tests). Concretely:

- No Postgres-specific SQL in migrations or queries.
- JSON columns via Laravel's `json` type — never raw `jsonb`.
- Date arithmetic via query builder / Eloquent, not raw PG functions.
- Where a Postgres feature is genuinely needed: hide it behind a service
  abstraction and cover it with a separate integration test (documented in the
  project's `features/`), plus the explicit Postgres gate below.

Open-acc runs that gate as `DB_HOST=dind bash scripts/test-pgsql.sh` against
the compose Postgres; `localhost:5432` is refused from that shell's network
namespace while the `dind` hostname resolves — measure reachability, do not
assume it.

## Migration policy (critical)

- Laravel timestamp naming (`YYYY_MM_DD_HHMMSS_*`). Deployed migrations are
  immutable: once a migration file has run on any shared database (dev DB with
  a volume, staging, CI with volumes, prod), it is never edited in place.
- Every later schema change gets its own new migration. Rationale: Laravel's
  migrator skips any filename already in the `migrations` ledger
  (`Migrator::pendingMigrations()`) — an in-place edit reaches only
  `migrate:fresh` and never an already-migrated database (measured incident:
  in-place column addition stayed green in the suite yet failed in production
  with `SQLSTATE 42703: column does not exist`).
- `down()` methods are never executed — leave them empty as a rule.
- New migrations are suspect by default: a new migration is only justified when
  the requirement cannot be met safely with existing tables, indexes, and job
  contracts. Document the schema/backfill/rollback decision before writing it.

## Seed policy (strict)

- After EVERY `migrate` / `migrate:fresh`, run `db:seed` (or the `--seed`
  flag). Without the seed there is no admin user and login/auth is dead; the
  `DatabaseSeeder` creates the admin via `firstOrCreate` from
  `ADMIN_EMAIL` / `ADMIN_PASSWORD`, so `ADMIN_PASSWORD` must be non-empty
  before setup.
- The seeder must declare authority per key: `upsert` = seeder-owned
  (overwrites production values on every run — by owner decision, documented),
  `firstOrCreate` / `insertOrIgnore` = create-only-if-missing (production
  values survive). Mixing them up silently breaks production (measured: a
  migration-seeded price in euros vs. a seeder-written price in cents failed
  checkout with 422).
- Container startup uses a seed-if-fresh guard (empty `users` table = fresh
  install → seed; otherwise no-op), never an unconditional `db:seed` — an
  unconditional seed re-clobbers authoritative keys on every restart. A manual
  `db:seed --force` in production stays possible with a pre-check of owned keys.
- The standard seeder stays network-free. E2E-only fixtures (e.g. location
  imports, search-index builds) live in dedicated seeders/commands invoked from
  the E2E setup script or CI — never from the standard seed or prod startup.
