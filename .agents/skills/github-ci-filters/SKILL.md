---
name: GitHub CI Filters
description: TRIGGER when adding, changing, or reviewing GitHub Actions path filters (`paths` / `paths-ignore`), when a docs-only commit triggers the full CI pipeline, or when a path-filtered workflow leaves a PR stuck on a pending check. Reference for the doc-as-input precondition, why `paths-ignore` is the safe direction, filtering both `push` and `pull_request`, the branch-protection pending-check trap, and verifying with `git diff --name-only`.
---

# GitHub CI Filters — keep docs-only commits out of the pipeline

Add a `paths-ignore` filter so a commit that only touches documentation does
not start the whole pipeline. One precondition, one asymmetry (Steps 1–2).
Background, anecdotes, and the worked example live in `references/notes.md`.
Upstream semantics below are defined in the [workflow syntax reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) — re-derive limits from there, never copy numbers from this file.

## Step 1 — precondition: does any check read a doc file as input?

Do this before writing a single line of YAML. A file is "docs-only" only if
nothing consumes it. A test asserting README commands, a policy test on
`AGENTS.md`, a link checker, or a release-notes parser makes that path a code
path — never filter it.

Run one repo-wide sweep:

```sh
grep -rnE "['\"][^'\"]*\.md['\"]" . \
  --include='*.php' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
  --include='*.sh' --include='*.py' --include='*.yml' --include='*.yaml' \
  --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git
```

Quote the `--include` globs. Unquoted, the shell expands them before `grep`
sees them and the command returns zero hits that look like a clean result.

Classify every hit: does it open a markdown path as input, or merely mention
one? A workflow `paths:` block is the filter itself, not a consumer. This grep
finds quoted literals only — close the gap over check directories:

```sh
grep -rn "AGENTS\|\.md\|docs/" tests scripts .github 2>/dev/null
```

A non-empty result is a hard stop until each hit is classified. An empty result
is suggestive, not proof. A docs lint, link checker, or markdown formatter in
a separate workflow needs its own filter decision, not a shared one.

Pass criterion: you can name every file that must *not* be ignored, and why.
"There are no doc tests" is not the criterion; the classified grep output is.

## Step 2 — `paths-ignore` (subtract), never `paths` (include-list)

Use `paths-ignore`. The failure modes are asymmetric: a too-narrow ignore list
costs one redundant run (loud, self-healing); a too-narrow include-list means
no job ever runs for a file outside the list, with no error (quiet,
permanent — a skipped workflow is not a failed workflow).

The safety property: when all changed paths match `paths-ignore`, the workflow
skips; if any path matches nothing, it runs. Docs-plus-code can never be
silently skipped. Never set `paths` and `paths-ignore` on the same event.

## Step 3 — filter both triggers, keep the branch filter

Filter both `push` and `pull_request`. Filtering one leaves the other
unprotected. Keep the existing `branches:` filter intact — branch and path
filters compose with AND. Before editing, dump the current triggers:

```sh
grep -nE '^\s*(on|push|pull_request|branches|branches-ignore|tags|paths|paths-ignore)' .github/workflows/*.yml
```

Path filters are not evaluated for tag pushes — releasing a docs commit still
runs the workflow. That is upstream behaviour, not a bug in the filter.

## Step 4 — never weaken a gate while adding a filter

The filter decides whether the workflow runs. Nothing inside the workflow
changes. Never remove, rename, or option-alize a job, step, matrix entry, or
timeout; never drop a required check from branch protection; never add
`continue-on-error: true`; never relax a lint rule. A job change is a second,
separate change — never bundle it into a filter commit.

Before committing, the workflow diff must contain only the `paths-ignore`
block (`git diff -- .github/workflows/`).

## Branch protection — check before adding the filter

A skipped workflow leaves its checks `Pending` forever, and a PR requiring
those checks cannot merge. Check first:

```sh
gh api repos/<owner>/<repo>/branches/<default-branch>/protection
```

- `404` with `Branch not protected` → safe to proceed.
- `404` with `Not Found` → wrong repo path or no access. You have no answer;
  confirm with `git remote get-url origin` first.
- JSON body → protection is active; read `required_status_checks`.
- `403` → you lack admin permission; you have no answer. Ask.

Decision rule:

1. No protection → add the filter. No exception to document.
2. Protection with required checks → do not filter a workflow whose jobs are
   in that list, unless the docs paths are genuinely outside the required set.
   Then document the exception next to the filter: a comment naming the
   branch-protection setting and who accepted it, in the same commit.
3. Unsure → ask the owner.

## Step 5 — verify without burning a push

Pick two commits already in history and enumerate their changed paths:

```sh
git diff --name-only <docs-base> <docs-head>
git diff --name-only <code-base> <code-head>
git diff --name-only <base>...<head>   # three dots: PR semantics
```

Pushes use a two-dot diff, PRs a three-dot diff — use three dots when
reasoning about a PR. For moves across the ignore boundary compare both forms:

```sh
git diff --name-only -M <base> <head>
git diff --name-only --no-renames <base> <head>
```

Pass criterion, both halves or the filter is unverified:

- Docs commit: every listed path matches at least one ignore pattern.
- Code commit: at least one path matches no ignore pattern. A code commit
  where every path is ignored is a bug.

Never verify with `git check-ignore` — it proves `.gitignore` behaviour, not
Actions'.

## Snippet — standard case

Replace `<…>` with the paths Step 1 cleared. Quotes are mandatory for patterns
starting with `*`, `[`, or `!`.

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

If Step 1 found a markdown consumer, delete the `'**/*.md'` line and keep the
narrower directory entries. `'*.md'` matches only the repo root — use
`'**/*.md'` for any depth. Never ignore a directory a doc merely sits in
(ignoring `src/**` "because it has a README" is forbidden), and never add the
workflow's own files (`.github/workflows/**`) to the ignore list — the
pipeline must always be able to test the pipeline.

## Project facts — repo-specific values only; everything above is generic.

```sh
grep -nE '^\s*(on|push|pull_request|branches|branches-ignore|tags|paths|paths-ignore)' .github/workflows/*.yml
gh workflow view <workflow-name-or-file> --yaml   # live workflow, not working copy
gh run view <run-id> --json jobs --jq '.jobs[].name'
gh api repos/<owner>/<repo>/branches/<default-branch>/protection
git log --oneline origin/main..HEAD
git status --porcelain
```
