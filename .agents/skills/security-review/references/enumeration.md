# Enumeration — the per-surface recipes

Stage 1 says *enumerate from the framework, never from memory*. This file is the
"how" for each surface class. Every recipe ends in a **command and its output** —
that pair is what a finding is allowed to rest on. Population first: a list of
offenders without the total it came from proves nothing.

## 1. Routes and middleware (the inventory)

Laravel is the framework's own answer; do not hand-grep `routes/api.php`.

```sh
cd backend && php artisan route:list --json > /tmp/routes.json
php -r '$r=json_decode(file_get_contents("/tmp/routes.json"),true);
$no=array_values(array_filter($r,fn($x)=>!preg_grep("/^auth/",$x["middleware"])));
printf("%d routes, %d without auth\n",count($r),count($no));'
```

`templates/laravel-route-audit.php` does the same classification with a readable
per-route dump; `--json` is the ground truth to cross-check it against.

- Classify every route: `auth:api` / `auth:sanctum` / `auth` = authenticated; none
  = public. Print the counts (`189 routes, 150 with auth:api, 39 without`).
- **Read the route *group*, not the route line.** The reference finding was a route
  that *looked* fine because its neighbours were grouped — it sat **outside** every
  group and carried no middleware at all.
- Cross-check the framework against a text search: a route registered
  conditionally, or via a `Route::resource`, does not appear as a literal string.
- Non-Laravel: use the router's own dump (`rake routes`, `manage.py show_urls`,
  Express `app._router.stack`, `next build` route manifest). The mechanism is
  "ask the framework", the command differs.

## 2. Config-driven exposure

A route that exists because a **config value** defaults to on is easy to miss —
it is not in `routes/` at all.

```sh
# static serving: Laravel registers GET|PUT /storage/{path} when a disk serves
php artisan route:list | grep -i storage
grep -rn "'serve'" backend/config/filesystems.php

# debug mode / dev tooling reachable in prod
grep -rnE "APP_DEBUG|TELESCOPE|HORIZON|DEBUGBAR" backend/.env.production backend/config 2>/dev/null
php artisan route:list | grep -iE "telescope|horizon|_debugbar"

# CORS
grep -rnE "allowed_origins|allowed_methods" backend/config/cors.php
```

Reference finding: `filesystems.disks.local.serve` was `true`, so Laravel
registered `GET|PUT /storage/{path}` **without middleware** over
`storage/app/private` — which held `stripe_secret.txt`. The fix was
`'serve' => false`; the proof was `php artisan route:list` showing **0** routes with
`storage` in the URI.

Also look for catch-all / fallback routes (`Route::any('{any}')`,
`Route::fallback`) and any route that proxies a request to another host.

## 3. Secrets

Never print a value; name the key and the path.

```sh
git ls-files | grep -E '(^|/)\.env'                 # tracked env files?
git log --all --oneline -- .env.production          # ever committed?
grep -rnE "env\('[A-Z_]+',\s*'[^']+'" backend/config backend/app   # hardcoded fallbacks
```

- A **hardcoded fallback** in `config/*.php` (`env('KEY', 'a-real-secret')`) means
  the app runs with a known value when the env is unset — the value is now public.
- A **secret inside a served directory** (uploads, `storage/app/public`, a build
  output) is reachable through §2 even if nothing greps for it.
- **History is part of the surface**: a value that was committed and later removed
  is still in `git log`. Decide with the owner whether that is a rotation or an
  accepted risk — do not silently ignore it.

## 4. Authz (authenticated ≠ authorized)

A route behind `auth:api` can still leak: authentication says *who*, not *what*.

- **IDOR:** take an id from another tenant/user and request it. The check is a real
  request with a real second identity, not reading the controller.
- **Tenant / brand scoping:** does every query go through the scoping layer
  (`forCurrentBrand()`-style global scope), or does a raw `find()` bypass it?
- **Role breadth:** a guard that admits `admin` may also admit `super_admin` — and
  a guard written as "not client" admits everyone else. List who *passes*, not who
  you expected.
- **Write wider than read:** a `POST`/`PUT`/`DELETE` with weaker middleware than the
  matching `GET` is a finding of its own.

```sh
# every write route, and its middleware — compare against the read route
php artisan route:list --json | php -r '$r=json_decode(stream_get_contents(STDIN),true);
foreach($r as $x) if(preg_grep("/^(POST|PUT|PATCH|DELETE)$/",$x["method"]))
  printf("%-8s %-40s %s\n",$x["method"],$x["uri"],implode(",",$x["middleware"]));'
```

## 5. Cross-repo consumers (before any contract change)

The impact of closing a public endpoint is set by who calls it — and the caller may
live in another repository.

- Search the consumers **before** the wave: the marketing/website repo, scripts,
  cron jobs, mobile apps, the import tooling. A grep for the route path across
  sibling checkouts is cheap; a broken importer is not.
- Classify each caller as **authenticated** (can log in and pass a token/cookie) or
  **genuinely public** (a browser, a static page, a build step). That classification
  is what Stage 4's decision turns on.
- When a genuinely public consumer exists, the answer is usually a **minimised
  public endpoint** next to the closed full one — not a public full one. Reference
  run: the full pricing payload went behind `auth:api` + `super_admin`, and a new
  `GET /api/settings/license-pricing` returned exactly `{pricing_strategy,
  volume_pricing}` for the client flow.
- If the consumer is in another repo, the change there is **its own task with its
  own owner** — do not reach across repos in the same wave.
