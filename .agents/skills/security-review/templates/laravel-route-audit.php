<?php

// templates/laravel-route-audit.php — enumerate every registered route with its
// middleware, and print the ones that carry no authentication middleware.
//
// Project-neutral skeleton. Copy it into the project (e.g. `backend/route-audit.php`),
// adapt the ADAPT comments, run it with `php route-audit.php`. It is **read-only**:
// it boots the framework's router and prints; it touches no data.
//
// The framework is the source of truth — run `php artisan route:list --json` as the
// ground truth and use this script for the classification the JSON does not do:
// "authenticated vs. not", with the population always named. Read the route
// *group*, not the route line: a route sitting outside every group has no
// middleware at all and looks fine next to its grouped neighbours (reference run:
// GET /api/settings/license-terms answered anonymously for exactly that reason).

require __DIR__ . '/vendor/autoload.php';

$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Route;

// ADAPT: the middleware names that count as "authenticated" in this project.
// A route carries the bare alias, or an alias with parameters ("auth:api").
$AUTH = ['auth', 'auth:api', 'auth:sanctum', 'auth:web'];

// ADAPT: middleware that is itself an authorization gate (authenticated AND
// scoped). A route with only these is not "public", but it is not plain "auth"
// either — report it in its own bucket.
$AUTHZ = ['can', 'super_admin', 'management', 'verified'];

$isAuth = static function (string $mw) use ($AUTH): bool {
    foreach ($AUTH as $a) {
        if ($mw === $a || str_starts_with($mw, $a . ':')) {
            return true;
        }
    }

    return false;
};

$isAuthz = static function (string $mw) use ($AUTHZ): bool {
    foreach ($AUTHZ as $a) {
        if ($mw === $a || str_starts_with($mw, $a . ':')) {
            return true;
        }
    }

    return false;
};

$total = 0;
$authed = 0;
$authzOnly = [];
$noAuth = [];

foreach (Route::getRoutes() as $route) {
    // HEAD is an alias of GET — counting it would inflate the population.
    $methods = array_values(array_diff($route->methods(), ['HEAD']));
    if ($methods === []) {
        continue;
    }
    $total++;

    // gatherMiddleware() merges the route's own middleware with the group's and
    // the controller's. If a route was registered outside every group, this is
    // empty — which is the finding, not a bug in the script.
    $middleware = $route->gatherMiddleware();
    $hasAuth = false;
    $hasAuthz = false;
    foreach ($middleware as $mw) {
        if (! is_string($mw)) {
            continue; // closures/objects: inspect by hand if one shows up
        }
        $hasAuth = $hasAuth || $isAuth($mw);
        $hasAuthz = $hasAuthz || $isAuthz($mw);
    }

    $row = [
        'methods' => implode('|', $methods),
        'uri' => $route->uri(),
        'name' => $route->getName() ?? '',
        'middleware' => implode(', ', $middleware),
    ];

    if ($hasAuth) {
        $authed++;
    } elseif ($hasAuthz) {
        $authzOnly[] = $row;
    } else {
        $noAuth[] = $row;
    }
}

printf("%d routes, %d with auth, %d authz-only, %d without auth\n\n",
    $total, $authed, count($authzOnly), count($noAuth));

echo "== routes without authentication ==\n";
foreach ($noAuth as $row) {
    printf("%-16s %-45s %s\n", $row['methods'], $row['uri'], $row['middleware'] !== '' ? $row['middleware'] : '(no middleware)');
}

echo "\n== routes with authorization middleware but no auth ==\n";
// A separate bucket on purpose: "authz without auth" is a different question for
// the owner, and lumping it into "without auth" would overstate the finding count.
foreach ($authzOnly as $row) {
    printf("%-16s %-45s %s\n", $row['methods'], $row['uri'], $row['middleware']);
}

// Cross-check before trusting this output:
//   php artisan route:list --json | ...  # framework's own resolution
// A mismatch means a route is registered conditionally, or via Route::resource /
// a route file this script did not see. Investigate the mismatch — do not average
// the two numbers.
