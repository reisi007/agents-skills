# Search — opt-in Meilisearch via Laravel Scout

Proven in `portal.reisinger.pictures/backend`
(`laravel/scout ^11`, `meilisearch/meilisearch-php ^1.16`). Without these
packages there is no search infrastructure: plain `where`/`LIKE` is the
default, and this whole page does not apply.

## What changes when enabled

| Area | Without Scout (default) | With Scout (opt-in) |
|---|---|---|
| Deps | none | `laravel/scout` + `meilisearch/meilisearch-php` |
| Config | none | `config/scout.php`: driver, chunk sizes, per-model `index-settings` |
| Env | none | `SCOUT_DRIVER=meilisearch`, `MEILISEARCH_HOST`, `MEILISEARCH_KEY` |
| Models | plain Eloquent | `Searchable` trait + `toSearchableArray()` whitelist |
| Ops | none | rebuild command (`app:search-rebuild`); Meilisearch service in compose + CI |
| Tests | plain assertions | flush + sync settings in `setUp()`, wait for tasks before asserting |

## Setup

1. `composer require laravel/scout meilisearch/meilisearch-php`.
2. `config/scout.php`: `'driver' => env('SCOUT_DRIVER', 'meilisearch')`,
   `'queue' => env('SCOUT_QUEUE', false)`, chunk sizes, and per-model
   `index-settings` — at minimum explicit `searchableAttributes` (field order
   first, otherwise IDs/UUIDs dominate non-deterministically),
   `filterableAttributes` for every faceted key, `sortableAttributes` for every
   sorted key, and explicit `typoTolerance` (`oneTypo: 4, twoTypos: 8`).
3. Env: `SCOUT_DRIVER=meilisearch`, `MEILISEARCH_HOST` (default
   `http://localhost:7700`), `MEILISEARCH_KEY`. CI runs a pinned image
   (portal: `getmeili/meilisearch:v1.48.3`) with a `wait-for-meilisearch` step
   before the suite.
4. Rebuild command (`app:search-rebuild` pattern): for each searchable model,
   `scout:flush` → then `scout:sync-index-settings` once → then `scout:import`
   per model → `queue:restart` so workers pick up fresh model definitions.

## Models

```php
use Laravel\Scout\Searchable;

class Photo extends Model
{
    use Searchable;

    public function toSearchableArray(): array
    {
        return [ /* whitelisted fields only — never secrets */ ];
    }

    public function shouldBeSearchable(): bool
    {
        return /* row must be publicly discoverable */;
    }
}
```

- `toSearchableArray()` is a whitelist: only fields the index needs.
- `shouldBeSearchable()` keeps hidden/private rows out of the index entirely
  (stronger than filtering at query time).
- A registration flow that must stay index-free simply omits `Searchable`
  (portal: `ModelProfile` deliberately has no trait).

## Testing approach

- `phpunit.xml` pins `SCOUT_DRIVER=meilisearch` plus `MEILISEARCH_HOST`/`KEY`
  pointing at the CI service, so search tests exercise the real engine.
- Test `setUp()`: `scout:flush` per model + `scout:sync-index-settings`.
  Indexing is async — poll task status (`enqueued`/`processing`) via the
  Meilisearch client (`waitForTask`) before asserting, otherwise assertions
  race the index.
- Index hygiene is itself tested: a test asserting that deleting a parent
  removes child rows from the index (portal: `GalleryPhotoScoutCleanupTest`),
  and a fixture-policy test keeping network downloads out of the standard
  seeders (portal: `E2ELocationFixturePolicyTest`).
- Non-search tests are unaffected: models without queries against the index
  never touch Meilisearch, and `SCOUT_QUEUE=false` keeps indexing synchronous.
