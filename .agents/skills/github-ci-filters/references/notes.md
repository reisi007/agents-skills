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

The second sweep names the *root* directories. Run it in every check
directory: a PHP test tree often lives in `backend/tests`, and a sweep that
covers only the root `tests/` never sees it. The repo-wide sweep covers every
tree, the per-directory sweep covers the hits a variable hides.

## Step 2 background

The safety argument rests on upstream AND-semantics: when all changed paths
match `paths-ignore`, the workflow does not run; if any path matches nothing,
it runs. That is why docs-plus-code always runs.

The same property holds for a `paths` list whose positive part contains the
catch-all `'**'`: every path matches it, so the list only subtracts. The
failure the rule forbids is a *selecting* positive part — one that names only
certain paths. There a file outside the selection matches no pattern, the
workflow does not run, and nothing reports it. The distinction is the width of
the positive part, not the word `paths`.

Related upstream facts: `paths` and `paths-ignore` cannot be set on the same
event; emulating both needs `paths` with `!` negations where order is
significant — and the order is what makes a re-inclusion work: a positive
pattern placed *after* the negation restores the paths it names. Look up the
exact wording in the workflow syntax reference linked from `SKILL.md`.

## Steps 3–4 background

Branch and path filters compose with AND: the workflow runs only when both are
satisfied. The branch filter limits which refs trigger; the path filter limits
what it reacts to. Deleting `branches:` while adding `paths-ignore` therefore
widens the trigger to every branch.

The gate rule exists because a filter diff looks trivially safe: bundling a
job removal or a `continue-on-error` into it hides a coverage deletion inside
an innocent-looking change.

The diff command needs named endpoints. `git diff -- .github/workflows/`
measures the working tree against the index: it shows the *uncommitted* state,
not the change a commit carries, and after the commit it shows nothing at all.
Measured in a scratch repository — one committed workflow file, then the same
file changed in the working tree, then that change committed:

| command | before the commit | after the commit |
| --- | --- | --- |
| `git diff -- .github/workflows/` | the two added lines | no output |
| `git diff --stat <sha-before>..<sha-after> -- .github/workflows/` | nothing to compare yet | `1 file changed, 2 insertions(+)` |

The same failure form was found and fixed in the project `opencode-pwa`
(commit `b7c318a`, finding B4: "the proof command used the working tree as an
endpoint and returns nothing today"). The shared rule that decides the
endpoint: `skills-marker/SKILL.md` → "Bezugsrahmen-Regel" (the wording stands
in `skills-marker/references/notes.md` § "Der Bezugsrahmen") — "Der Endpunkt
ist der **benannte Commit**, dessen Aussage belegt wird, nicht `HEAD`."

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

## Worked example (measured, illustrative only)

From a PHP/Laravel + React portal repo — not this repo, not a default.

Measured before any filter existed: a commit touching only `AGENTS.md` and
`AGENTS.todo.md` ran 11 jobs, 6 of them Playwright shards — run `36743086900`
on commit `3352977` (`gh run view 36743086900 --json jobs --jq '.jobs[].name'`
→ 11 job names; six are the shards "Desktop 1/3 … 3/3" and "Mobile 1/3 …
3/3", the seventh Playwright job is the serial suite). Never quote a job count
without the command.

The filter added there is the catch-all `paths` form, not `paths-ignore`:

```yaml
on:
  push:
    paths:
      - '**'
      - '!**/*.md'
      - 'features/infrastructure/**'
      - 'features/ai/**'
      - 'features/security/**'
      - 'features/e2e-test-strategy.md'
  pull_request:
    paths:
      - '**'
      - '!**/*.md'
      - 'features/infrastructure/**'
      - 'features/ai/**'
      - 'features/security/**'
      - 'features/e2e-test-strategy.md'
```

(`.github/workflows/ci.yml`, the `paths:` block under `push` and the identical
one under `pull_request`.)

The owner's decision behind it is D-23 in `features/owner-decisions.md` —
"Documentation-only CI filtering": "Keep `paths` with `'**'` as the sole
positive pattern and retain re-inclusions for `features/infrastructure/**`,
`features/ai/**`, and `features/e2e-test-strategy.md`. Do not replace the
filter with a blanket Markdown ignore." The project marker records the skill as
applied (`ja`), naming the `paths:` block under `push` and `pull_request` and
D-23.

Why the form is safe: `'**'` is the catch-all positive pattern, so every path
matches it and the list only subtracts — the failure Step 2 forbids (a
selecting positive part) does not occur. The trailing patterns restore paths
the negations dropped; they can only add runs, never remove them.

Measured Step 1 classification in that repo, at the committed stand of the
workflow file: the repo-wide sweep with quoted `--include` globs returns
**4** hits — all of them the filter itself in `.github/workflows/ci.yml` (the
two `!**/*.md` negations and the two `features/e2e-test-strategy.md`
re-inclusions). The gap sweep `grep -rn "AGENTS\|\.md\|docs/" tests scripts
.github` returns **21** hits — all of them comments, prose mentions, or the
filter itself; **0** of them open a markdown path as input. The repo's own
policy test says the same in its docblock: "Prose is deliberately not
scanned." So the re-inclusions are conservative in the measured state: they
restore paths that have no consumer, which costs runs, not silence. A consumer
would make them mandatory (Step 1 → Step 2).

Two measured caveats. The gap sweep names the root-level `tests`, `scripts` and
`.github` directories, while the repo's PHP tests live in `backend/tests` — the
repo-wide sweep is what covers that tree. And the workflow carries one
re-inclusion beyond the three D-23 names (`features/security/**`), added with
the commit `8c0c32f` that made the security findings a gate; that gate's own
input is the root-level `ratchet.findings.json` — a `.json` path that
`!**/*.md` does not exclude — and the JSON references the markdown document by
path rather than opening it. No file in the checked-out tree opens a markdown
path as input; the ratchet action is external and pinned, so its own reads are
not visible in the tree.

`main` carries no branch protection (`gh api repos/<owner>/<repo>/branches/
main/protection` → HTTP 404 with the body "Branch not protected"), so a
path-filtered run cannot strand a PR on a required check.

Re-derive the numbers and the current state for your own repo; do not copy that
shape.
