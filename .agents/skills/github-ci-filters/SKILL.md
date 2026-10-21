---
name: GitHub CI Filters
description: 'TRIGGER when adding, changing, or reviewing GitHub Actions path filters (`paths` / `paths-ignore`, both `push` and `pull_request`), when a docs-only commit triggers the full CI pipeline, or when a path-filtered workflow leaves a PR stuck on a pending check (branch-protection trap).'
metadata:
  opencode/autoinvoke: false
---

# GitHub CI Filters — keep docs-only commits out of the pipeline

Add a path filter — `paths-ignore` by default — so a commit that only touches documentation does not start the whole
pipeline. One precondition, one asymmetry (Steps 1–2). Background and the worked example live in
`references/notes.md`. Upstream semantics are defined in the [workflow syntax
reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) — re-derive limits from
there, never copy numbers from this file.

## Step 1 — precondition: does any check read a doc file as input?

Before writing YAML: a file is "docs-only" only if nothing consumes it. A test asserting README commands, a policy
test on `AGENTS.md`, a link checker, or a release-notes parser makes that path a code path — never filter it.

Run a repo-wide sweep, then close the gap over the check directories:

```sh
grep -rnE "['\"][^'\"]*\.md['\"]" . \
  --include='*.php' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.sh' --include='*.py' \
  --include='*.yml' --include='*.yaml' --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git
grep -rn "AGENTS\|\.md\|docs/" tests scripts .github 2>/dev/null
```

Quote the `--include` globs: unquoted, the shell expands them before `grep` sees them and the command returns zero
hits that look like a clean result. Run the second sweep in every check directory — PHP tests often live in
`backend/tests`, not a root `tests/`.

Classify every hit — does it open a markdown path as input, or merely mention one? A workflow `paths:` block is the
filter, not a consumer. A non-empty result is a hard stop until every hit is classified; an empty one is suggestive,
not proof. A docs lint, link checker, or markdown formatter in another workflow needs its own filter decision.

Pass criterion: you can name every file that must *not* be ignored, and why. "There are no doc tests" is not the
criterion; the classified grep output is.

## Step 2 — subtract, don't select: `paths-ignore`, or `paths` with a catch-all

The two forms differ not in the word but in the width of the positive part. A too-narrow ignore list costs one
redundant run (loud, self-healing); a positive part that *selects* — an include-list naming only certain paths — means
no job ever runs for a file outside that selection, with no error (quiet, permanent — a skipped workflow is not a
failed workflow). Selecting is the case to prevent.

A `paths` list whose positive part contains the catch-all `'**'` only subtracts: every path matches it, the negations
drop paths, and a narrower positive pattern *after* a negation restores one (order is significant). It carries no
silent-skip failure — it triggers the same paths as the equivalent `paths-ignore`, sometimes more, never fewer. Prefer
`paths-ignore`; where the owner has decided on the `paths` form, document that decision at the filter.

The safety property: when every changed path is excluded, the workflow skips; if any path is excluded by nothing, it
runs. Docs-plus-code can never be silently skipped — under `paths-ignore` and under the catch-all `paths` form alike.
Never set `paths` and `paths-ignore` on the same event.

One question decides: does every path match at least one positive pattern? Catch-all → the list subtracts, allowed. A
positive part naming only certain paths → it selects, forbidden. Step 1 picks the pattern, Step 2 the form: a check
that opens a markdown path as input makes it a code path, so excluding it skips that check silently and it must be
re-included — a positive pattern after the negation. A consumer forces re-inclusions; without one, none are needed.

## Step 3 — filter both triggers, keep the branch filter

Filter both `push` and `pull_request`. Filtering one leaves the other unprotected. Keep the existing `branches:`
filter intact — branch and path filters compose with AND. Before editing, dump the current triggers (the live file,
not the working copy):

```sh
gh workflow view <workflow-name-or-file> --yaml
grep -nE '^\s*(on|push|pull_request|branches|branches-ignore|tags|paths|paths-ignore)' .github/workflows/*.yml
```

Path filters are not evaluated for tag pushes — releasing a docs commit still runs the workflow. That is upstream
behaviour, not a bug in the filter.

## Step 4 — never weaken a gate while adding a filter

The filter decides whether the workflow runs. Nothing inside the workflow changes. Never remove, rename, or
option-alize a job, step, matrix entry, or timeout; never drop a required check from branch protection; never add
`continue-on-error: true`; never relax a lint rule. A job change is a second, separate change — never bundle it into a
filter commit.

**Branch protection — check before adding the filter.** A skipped workflow leaves its checks `Pending` forever, and a
PR requiring those checks cannot merge. Check first:

```sh
gh api repos/<owner>/<repo>/branches/<default-branch>/protection
```

- `404` with `Branch not protected` → safe to proceed: add the filter, no exception to document.
- `404` with `Not Found` → wrong repo path or no access. You have no answer; confirm with `git remote get-url origin`
  first.
- JSON body → protection is active; read `required_status_checks`.
- `403` → you lack admin permission; you have no answer. Ask.
- Protection with required checks → do not filter a workflow whose jobs are in that list, unless the docs paths are
  genuinely outside the required set; then document the exception next to the filter — a comment naming the
  branch-protection setting and who accepted it, in the same commit.
- Unsure → ask the owner.

Before committing, the workflow diff must contain only the filter block — the `paths-ignore` list or the catch-all
`paths` list, and nothing else. Compare the commit with the state it replaces, both endpoints named:

```sh
git diff --stat <sha-before>..<sha-after> -- .github/workflows/
```

`<sha-before>` is the commit that last wrote the workflows, `<sha-after>` the one you are writing. A working-tree diff
measures the uncommitted state against the index — a change not committed yet, and after the commit nothing at all.

## Step 5 — verify without burning a push

Pick two commits already in history and enumerate their changed paths:

```sh
git diff --name-only <base> <head>      # two dots: a push
git diff --name-only <base>...<head>    # three dots: a pull request
```

For a move across the ignore boundary, compare both forms (`-M` and `--no-renames`). Pass criterion, both halves or
the filter is unverified:

- Docs commit: every listed path matches at least one ignore pattern.
- Code commit: at least one path matches no ignore pattern. A code commit where every path is ignored is a bug.

Never verify with `git check-ignore` — it proves `.gitignore` behaviour, not Actions'.

## Snippet — standard case

Replace `<…>` with the paths Step 1 cleared. Quotes are mandatory for patterns starting with `*`, `[`, or `!`. The
list goes under both triggers, next to the `branches:` filter that is already there:

```yaml
on:
  push:
    branches:                    # keep the filter that is already here
      - main
    paths-ignore:
      - '**/*.md'                # ⚠ only if Step 1 found NO check that reads .md
      - 'docs/**'
      - '<other-docs-dir>/**'
  pull_request:                  # the same branches and the same list
    branches: [main]
    paths-ignore: ['**/*.md', 'docs/**', '<other-docs-dir>/**']
```

If Step 1 found a markdown consumer, delete the `'**/*.md'` line and keep the narrower directory entries. `'*.md'`
matches only the repo root — use `'**/*.md'` for any depth. Never ignore a directory a doc merely sits in (ignoring
`src/**` "because it has a README" is forbidden), and never add the workflow's own files (`.github/workflows/**`) to
the ignore list — the pipeline must always be able to test the pipeline. The catch-all `paths` variant and its YAML
live in `references/notes.md`.
