---
name: GitHub CI Filters
description: TRIGGER when adding, changing, or reviewing GitHub Actions path filters (`paths` / `paths-ignore`), when a docs-only or README-only commit is triggering the full CI pipeline, when deciding whether CI should run for a path-filtered push or pull request, or when a path-filtered workflow leaves a pull request stuck on a permanently pending check. Reference for keeping docs-only pushes out of the run: the doc-as-input precondition to check before writing any filter, why `paths-ignore` is the safe direction and an include-list is not, filtering both `push` and `pull_request`, the branch-protection pending-check trap, and verifying a filter with `git diff --name-only` instead of burning a push.
---

# GitHub CI Filters — keep docs-only commits out of the pipeline

A `paths-ignore` filter on the CI workflow so a commit that only touches
documentation does not start the whole pipeline. Generic workflow — anything
specific to one repository lives in **Project facts** at the bottom.

The design has exactly one precondition and one asymmetry. Get both right and
the change is safe; get the precondition wrong and you have deleted CI coverage
for files a check actually reads.

## The failure mode it prevents

**A workflow without a path filter runs every job on every push.** There is no
"docs job" and no cheap path — the trigger fires, the matrix expands, and every
shard of the test suite starts for a commit that changed a sentence of prose.

One measured example (from a PHP/Laravel + React repo, shown as an illustration
of the shape of the waste, not as a universal number): a commit touching only
`AGENTS.md` and `AGENTS.todo.md` ran **11 jobs, including 6 Playwright shards**.
Reproduce the count for any run yourself — the number is per-repo and per-run,
never quote it without the command:

```sh
gh run view <run-id> --json jobs --jq '.jobs[].name'
```

The point is not the 11. The point is that **the run proves nothing about the
files that changed.** It is cost, not signal — and because it is green, it also
teaches everyone that CI being green means very little. That is the second,
slower failure: a pipeline that always runs is a pipeline nobody reads.

## Step 1 — the precondition: does any check read a doc file as input?

**This decides the design. Do it before writing a single line of YAML.**

A documentation file is "docs-only" only if nothing consumes it. Plenty of repos
have checks that read markdown as a real input: a test asserting that every
command in `README.md` is valid, a policy test asserting a key exists in
`AGENTS.md`, a docs-link checker, a release-notes parser. For those paths, a
commit **is** a code change, and it must not be filtered out.

One repo-wide sweep, runnable in any repo without knowing its layout:

```sh
grep -rnE "['\"][^'\"]*\.md['\"]" . \
  --include='*.php' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
  --include='*.sh' --include='*.py' --include='*.yml' --include='*.yaml' \
  --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git
```

**Quote the `--include` globs.** Unquoted, they are expanded by the shell before
`grep` ever sees them: zsh aborts the whole command with
`zsh: no matches found: --include=*.php` and returns **zero hits** — which looks
exactly like the clean result you were hoping for. The quoting is not style.

Read every hit as: *does this open a markdown path as input, or does it merely
mention one?* Test files that `assertFileExists('docs/...')` or parse a changelog
are the real hits. A workflow step with a `paths:` block is not a consumer — it
is the filter itself.

**Know the limits of this grep, because they are real.** It finds quoted literal
paths only. It misses `__DIR__ . '/../AGENTS.md'`, heredocs, backticks, and
paths assembled from variables. So treat a **non-empty result as a hard stop**
(no filter until each hit is classified) and treat an **empty result as
suggestive, not proof**. To close the gap cheaply, also grep the directories
where the checks live, with the file extension dropped:

```sh
grep -rn "AGENTS\|\.md\|docs/" tests scripts .github 2>/dev/null
```

If the repo has a docs lint, a link checker, or a markdown formatter as a
**separate workflow**, that workflow is a consumer too — but it is covered by
its *own* trigger, so it needs its own filter decision, not a shared one.

**Pass criterion for Step 1:** you can name every file that should *not* be
ignored, and you know why. "There are no doc tests" is not the criterion; the
classified grep output is.

## Step 2 — `paths-ignore` (subtract), not `paths` (include-list)

**Recommendation: use `paths-ignore`. The two directions fail asymmetrically.**

| | Wrong config costs | Failure mode |
|---|---|---|
| `paths-ignore` | one redundant CI run | **loud and self-healing** — the next run happens anyway |
| `paths` | CI silently stops | **quiet and permanent** — the check that would have caught the bug never ran |

A `paths-ignore` list that is too narrow skips nothing; it just runs the
pipeline once more than strictly necessary, and the commit after it is filtered
correctly. An include-list that is too narrow is the dangerous one: a source file
outside the list means **no job ever runs for it**, and nothing reports an error,
because a skipped workflow is not a failed workflow.

The semantics that make `paths-ignore` safe — quoting GitHub's own
documentation: *"When all the path names match patterns in `paths-ignore`, the
workflow will not run. If any path names do not match patterns in
`paths-ignore`, even if some path names match the patterns, the workflow will
run."*

**That AND-semantics is the whole safety argument.** A commit that touches
`README.md` *and* `src/app.ts` still runs the whole pipeline, because one path
missed the ignore list. Docs-plus-code can never be silently skipped. An
include-list has no such property.

Two related facts from the same reference, because they decide the shape of the
edit:

- You cannot set `paths` and `paths-ignore` on the same event. If you need both
  include and exclude behaviour, use `paths` with `!` negations, and remember
  the order is significant — a negation *after* a positive match excludes.
- You do not need that here. `paths-ignore` is the correct single mechanism.

## Step 3 — both triggers, and keep the branch filter

**A filter on only one of `push` and `pull_request` leaves the other
unprotected.** Most repos have both: `push` gates the branch, `pull_request`
gates the PR. Filter both, or a docs-only push on a branch runs the full
pipeline while a docs-only PR does not — an inconsistency nobody will notice
until it costs money twice.

And: **keep the existing `branches:` filter intact.** The two filter types
compose with AND — *"the workflow will only run when both filters are
satisfied."* The branch filter limits *which refs* trigger the workflow; the
path filter limits *what the workflow reacts to*. Adding one must not delete the
other. Before editing, dump what is there:

```sh
grep -nE '^\s*(on|push|pull_request|branches|branches-ignore|tags|paths|paths-ignore)' .github/workflows/*.yml
```

One more behaviour to know before you rely on it: **path filters are not
evaluated for tag pushes.** A tag push is not filtered by paths at all, so
releasing a docs commit still runs the workflow. That is GitHub's behaviour, not
a bug in your filter.

## Step 4 — never weaken a gate while adding a filter

**The filter decides whether the workflow runs. Nothing inside the workflow
changes.** A path filter is not a licence to:

- remove, rename, or make optional a job, step, matrix entry, or timeout
- drop a required check from the branch-protection list
- turn a failing test into `continue-on-error: true`
- relax a lint rule because "docs don't need it"

If adding the filter makes you want to touch a job, you have found a second,
separate change. Make it separately, with its own justification — and never
bundle a gate weakening into a filter commit, because the filter's diff will
look trivially safe while quietly removing a check.

Before committing, the diff of the workflow file should contain **only** the
`paths-ignore` block:

```sh
git diff -- .github/workflows/
```

## Branch protection — check this *before* adding the filter

**A path-filtered workflow whose run is skipped leaves its checks in a
"Pending" state forever.** GitHub's documentation is explicit: *"If a workflow is
skipped due to path filtering, branch filtering, or a commit message, then checks
associated with that workflow will remain in a 'Pending' state. A pull request
that requires those checks to be successful will be blocked from merging."*

So the failure mode of a filter on a protected branch is not a green CI. It is a
docs-only PR that **cannot be merged**, with a check that will never report.

Check the protection state first:

```sh
gh api repos/<owner>/<repo>/branches/<default-branch>/protection
```

- **`404 Branch not protected`** → no required-check list; a skipped workflow
  has nothing to wait for. Safe to proceed.
- **A JSON body** → protection is active. Read `required_status_checks` in it.

**Read the message, not just the status code.** This endpoint returns `404` for
two different situations, and they mean opposite things:

| `404` message | Meaning |
|---|---|
| `Branch not protected` | the branch exists and is unprotected — the answer you wanted |
| `Not Found` | the repo path is wrong, or you lack access — **you have no answer** |

A typo'd `<owner>/<repo>` looks exactly like a reassuring "not protected" if you
only check the status code. Confirm the path against the remote first:

```sh
git remote get-url origin
```

Note this endpoint needs admin permission on the repo; without it you get a 403
rather than an answer. If you cannot read it, ask — do not assume "probably not
protected", because that assumption is exactly what produces the stuck PR.

**Decision rule:**

1. **No branch protection →** add the filter. No exception to document.
2. **Branch protection with required checks →** do not add the filter to a
   workflow whose jobs are in that list, *unless* the docs paths are genuinely
   outside the required set. Then document the exception next to the filter —
   a comment in the workflow file naming the branch-protection setting and who
   accepted it.
3. **Unsure →** ask the owner. The cost of asking is one message; the cost of
   being wrong is a merge queue nobody can clear.

The exception, when it is taken, is a real one: the docs-only PR gets no CI, and
that is a deliberate trade of coverage for minutes. Write it down in the same
commit as the filter.

## Step 5 — verify without burning a push

**You do not need to reproduce GitHub's glob engine.** Because of the AND
semantics in Step 2, the filter is correct if two cheap conditions hold. Pick two
commits that already exist in the history and enumerate their changed paths:

```sh
# a known docs-only commit
git diff --name-only <docs-base> <docs-head>

# a known code commit
git diff --name-only <code-base> <code-head>
```

**Pass criterion — both halves, or the filter is not verified:**

- **Docs commit:** *every* path it lists matches at least one ignore pattern.
  One unmatched path means the pipeline still runs and the filter is a no-op for
  that commit.
- **Code commit:** *at least one* path matches *no* ignore pattern. That single
  path is what re-enables the workflow, and it is sufficient. **A code commit
  where every path is ignored is a bug** — that is the failure this whole
  exercise is designed to make loud.

**Mind the diff that GitHub actually uses, because it is not always yours:**
pushes are compared with a **two-dot** diff, pull requests with a **three-dot**
diff. So for a PR, the faithful reproduction is:

```sh
git diff --name-only <base>...<head>          # three dots, PR semantics
```

Using a two-dot diff to reason about a PR can show extra files that the real
filter never saw — it errs toward "still runs", which is the safe direction, but
it is not what you are verifying.

**Renames and moves.** A file that moves across the ignore boundary appears as a
delete of the old path plus an add of the new one, and rename detection can
collapse the pair to just the destination. Compare both forms to see what your
command is hiding:

```sh
git diff --name-only -M        <base> <head>     # rename-collapsed
git diff --name-only --no-renames <base> <head>  # delete + add
```

A move *out of* an ignored docs directory *into* a code directory must re-enable
CI. Verify that the destination path shows up and is not ignored — if you only
ran the rename-collapsed form, you checked the wrong thing.

## The snippet — standard case

Copy, then replace the `<…>` entries with the paths Step 1 cleared. Note the
quotes: they are mandatory, not stylistic.

```yaml
on:
  push:
    branches:                    # keep the filter that is already here
      - main
    paths-ignore:
      - '**/*.md'                # ⚠ only if Step 1 found NO check that reads .md
      - 'docs/**'
      - '<other-docs-dir>/**'
  pull_request:                  # same list, same reason
    branches:
      - main
    paths-ignore:
      - '**/*.md'
      - 'docs/**'
      - '<other-docs-dir>/**'
```

**`⚠` is the load-bearing comment.** The whole `'**/*.md'` line is only correct
if Step 1 proved nothing reads markdown. If it did, delete that line and keep the
narrower directory entries.

## Traps

| Trap | What actually happens | Do instead |
|---|---|---|
| Ignoring a directory because a doc file lives in it | real code in that directory is now unfiltered **only if** every changed file there is ignored — but any code file in the dir that the ignore list doesn't match still triggers. Ignoring `docs/**` is fine; ignoring `src/**` "because it has a README" is not | ignore docs paths, never the directory a doc merely sits in |
| `'*.md'` for "all markdown" | matches **only `.md` at the repository root** — nested docs are not filtered | `'**.md'` or `'**/*.md'`, both documented to match at any depth *including* the root |
| unquoted `- **/*.md` | YAML **parse error** that prevents the workflow from running at all | always quote patterns starting with `*`, `[`, or `!` |
| filter on `push` only | `pull_request` pushes and PRs run unfiltered | filter both triggers |
| deleting `branches:` while adding `paths-ignore` | every branch triggers, not just `main` | the two filters compose with AND; keep both |
| filtering `.github/workflows/**` out | edits to the pipeline itself stop being verified | keep the workflow's own files **out** of the ignore list — they never match a docs pattern, so they keep triggering CI. This is the rule, and it needs no exception: *the pipeline must always be able to test the pipeline* |
| huge push (1000+ commits) or a diff timeout | the workflow **always runs** — GitHub fails open here | documented, intentional, no action |
| push touching 3000+ files with matches beyond the first 3000 | the workflow **does not run** | documented GitHub limit; narrow your filters if you hit it |
| no files changed at all | workflow does not run | documented |
| verifying with `git check-ignore` | proves your `.gitignore` behaviour, not Actions' — the two engines anchor differently | use the Step 5 diff enumeration instead |

## Project facts

Repository-specific commands and values. Everything above is generic.

- **Is a filter already present, and where?**
  ```sh
  grep -nE '^\s*(on|push|pull_request|branches|branches-ignore|tags|paths|paths-ignore)' .github/workflows/*.yml
  ```
- **Read the live workflow, not your working copy** — what GitHub is running may
  differ from the branch on disk:
  ```sh
  gh workflow view <workflow-name-or-file> --yaml
  ```
- **Which jobs actually ran in a given run** (the number to cite before calling
  a run wasteful):
  ```sh
  gh run view <run-id> --json jobs --jq '.jobs[].name'
  ```
- **Is the default branch protected, and with which required checks?**
  ```sh
  gh api repos/<owner>/<repo>/branches/<default-branch>/protection
  ```
  `404 Branch not protected` = no required-check list. A JSON body = read
  `required_status_checks`.
- **Commits that are not on `origin/<default>` yet** — check this before
  assuming a push happened, and before concluding a run is stale:
  ```sh
  git log --oneline origin/main..HEAD
  ```
- **Local unpushed changes**:
  ```sh
  git status --porcelain
  ```

Worked example, illustrative only — from a PHP/Laravel + React portal repo, not
from this repo and not a default. Measured before any filter existed: a commit
touching only `AGENTS.md` and `AGENTS.todo.md` ran **11 jobs, 6 of them
Playwright shards**. In that repo no check read those markdown files and `main`
carried no branch protection, both re-derived with the commands above.

**The instructive part is what happened next.** The filter that was actually
added there used the include-list form — `paths: ['**', '!**/*.md', …]` with
several documentation directories re-included by positive pattern, because
policy tests in that repo genuinely read markdown. That is precisely the
direction Step 2 calls the dangerous one, and it needed those re-inclusions to
work at all. It happens to be correct, because every consumer was found
first — but it carries the failure mode from Step 2, and it is why this skill
recommends `paths-ignore` rather than describing what was done there. Re-derive
the numbers and the current state for your own repo; do not copy that shape.