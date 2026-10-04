# Notes — GitHub CI Filters

Justifications, anecdotes, and the worked example moved out of `SKILL.md`.
Nothing here is a rule; the obligations live in `SKILL.md` alone.

## The failure mode (why this skill exists)

A workflow without a path filter runs every job on every push. There is no
"docs job" and no cheap path — the trigger fires, the matrix expands, and every
shard starts for a commit that changed a sentence of prose.

One measured illustration of the shape of the waste (PHP/Laravel + React repo,
not a universal number): a commit touching only `AGENTS.md` and
`AGENTS.todo.md` ran 11 jobs, including 6 Playwright shards. Reproduce the count
for any run with:

```sh
gh run view <run-id> --json jobs --jq '.jobs[].name'
```

Never quote the 11 without that command. The point is not the number but that
the run proves nothing about the changed files: cost, not signal. A pipeline
that always runs is a pipeline nobody reads — the slower, second failure.

## Step 1 background

Why the sweep matters: "docs-only" is a property of the consumers, not of the
extension. Test files that `assertFileExists('docs/...')` or parse a changelog
are the real hits.

Why the quoting matters: with unquoted globs, zsh aborts with
`zsh: no matches found: --include=*.php` and returns zero hits — identical to
the clean result you hoped for.

Why an empty grep is not proof: the pattern matches quoted literals only. It
misses `__DIR__ . '/../AGENTS.md'`, heredocs, backticks, and paths assembled
from variables. Hence the rule: non-empty is a hard stop, empty is suggestive,
and the second sweep over `tests scripts .github` with the extension dropped
closes the gap cheaply.

## Step 2 background

The safety argument rests on upstream AND-semantics: when all changed paths
match `paths-ignore`, the workflow does not run; if any path matches nothing,
it runs. That is why docs-plus-code always runs, and why an include-list has
no equivalent property.

Related upstream facts that shaped the recommendation: `paths` and
`paths-ignore` cannot be set on the same event; emulating both needs `paths`
with `!` negations where order is significant. This skill never needs that —
`paths-ignore` alone is the correct mechanism. Look up the exact wording in the
workflow syntax reference linked from `SKILL.md`.

## Steps 3–4 background

Branch and path filters compose with AND: the workflow runs only when both are
satisfied. The branch filter limits which refs trigger; the path filter limits
what it reacts to. Deleting `branches:` while adding `paths-ignore` therefore
widens the trigger to every branch.

The gate rule exists because a filter diff looks trivially safe: bundling a
job removal or a `continue-on-error` into it hides a coverage deletion inside
an innocent-looking change.

## Branch-protection background

Upstream behaviour: a workflow skipped by path, branch, or commit-message
filter leaves its checks `Pending` forever, and a PR requiring those checks is
blocked from merging. So on a protected branch the failure mode is not green CI
but a docs-only PR that cannot merge.

The `404` ambiguity: the protection endpoint returns `404` both when the
branch exists and is unprotected (`Branch not protected` — the answer you
wanted) and when the repo path is wrong or you lack access (`Not Found` — you
have no answer). Checking only the status code makes a typo look reassuring.

## Step 5 background

GitHub compares pushes with a two-dot diff and PRs with a three-dot diff. A
two-dot diff used to reason about a PR can show extra files the real filter
never saw — it errs toward "still runs", the safe direction, but it is not
what is being verified.

Renames: a file moving across the ignore boundary appears as delete plus add,
and rename detection can collapse the pair to the destination. A move out of
an ignored docs directory into a code directory must re-enable CI, so the
destination path must show up as non-ignored — the rename-collapsed form alone
checks the wrong thing.

## Trap details

- `docs/**` ignored is fine; `src/**` ignored "because it has a README" hides
  real code.
- `'*.md'` vs `'**/*.md'`: the former matches only the repository root; both
  `'**.md'` and `'**/*.md'` match at any depth including the root, per the
  upstream filter-pattern syntax.
- Upstream edge cases (look up current limits in the workflow syntax
  reference rather than copying numbers here): oversized pushes and diff
  timeouts fail open and the workflow runs; pushes touching very large file
  counts have a matching cap after which the workflow does not run; a push
  changing no files does not run.
- Unquoted `- **/*.md` is a YAML parse error that stops the workflow from
  running at all — hence the mandatory quotes in the snippet.

## Worked example (illustrative only)

From a PHP/Laravel + React portal repo — not this repo, not a default.
Measured before any filter existed: a commit touching only `AGENTS.md` and
`AGENTS.todo.md` ran 11 jobs, 6 of them Playwright shards. In that repo no
check read those markdown files and `main` carried no branch protection, both
re-derived with the Step 1 and branch-protection commands.

What happened next is instructive: the filter actually added there used the
include-list form — `paths: ['**', '!**/*.md', …]` with several documentation
directories re-included by positive pattern, because policy tests in that repo
genuinely read markdown. That is precisely the direction Step 2 calls the
dangerous one; it needed those re-inclusions to work at all. It happens to be
correct because every consumer was found first, but it carries the Step 2
failure mode — which is why the skill recommends `paths-ignore` rather than
describing what was done there. Re-derive the numbers and current state for
your own repo; do not copy that shape.
