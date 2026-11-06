# Providers — one workflow, interchangeable Git hosts

The workflow is provider-neutral; every tracker operation goes through
`scripts/providers/<name>.mjs`. GitHub is fully implemented. GitLab/Gitea are
slots with the same contract — add a file, register it, test it.

## Why an adapter

- The skill must not grow `gh`-specific branches. `--admin`, review markers,
  raw-image URLs, required checks and merge methods differ per host.
- A project names its provider explicitly (`provider` in the config). Never
  infer it from `git remote` — a mirror or a self-hosted host would fool it.
- Unsupported capability is an **error**, never a silent skip. A missing check
  API must not turn into "merge anyway".

## Contract

A provider module exports one object with these methods:

| Method | Input | Output / behaviour |
|---|---|---|
| `verifyAccount(user)` | configured account name | confirms the already-authenticated host CLI identity; must not change global auth state |
| `listIssues({project, limit, includeTruncation})` | project id; optional positive cap and truncation metadata flag | issue array; with `includeTruncation: true`, returns `{issues, truncated}` |
| `viewIssue` | `{project, number}` | `{number,title,body,author:{login},labels,url,state,comments:[{author:{login},body,createdAt}]}` |
| `addLabel` / `removeLabel` | `{project, number, label}` | creates/removes the label on the issue |
| `comment` | `{project, number, body, kind}` | posts an issue (`kind: issue`) or change-request (`kind: change`) comment |
| `viewChange` | `{project, number}` | `{number,state,isDraft,url,headRefName,headRefOid,baseRefName,baseRefOid,body,author,comments,reviews,reviewDecision,mergeable,mergeStateStatus}` |
| `checks` | `{project, number, required, watch, interval}` | exit-style status: `0` only when a nonempty required-check set is green, `8` pending, other = failed/unavailable (including no required checks); watch adapters must respect host CLI flag constraints |
| `verifyEvidence` | `{project,commit,issue,change,head}` | confirms the SHA-pinned manifest identity and artifact blobs exist in that project |
| `merge` | `{project, number, method, headSha}` | merges with the mapped method and exact expected head SHA; no bypass flag |
| `createChange` | `{project, head, base, title, bodyFile}` | opens the PR/MR, returns `{url, number}` |
| `ensureLabel` | `{project, name, color, description}` | creates or updates a label |
| `rawUrl` | `{project, ref, path}` | browsable raw URL for evidence artifacts |

Terminology: the interface says **change**; GitHub renders it PR, GitLab MR.

## GitHub (implemented)

| Contract | Implementation |
|---|---|
| account | `gh api user --jq .login` must match configured account; no global switch or token extraction |
| issues | Watcher: request `gh api repos/<owner>/<repo>/issues?state=open&per_page=<size>&page=<n>` page-by-page with a `--jq` field projection, excluding pull requests and normalizing fields. Bounded scans stop at the cap after checking one extra issue to report `truncated` accurately; the same page size is used throughout pagination. Each `gh` response is capped at 8 MiB with an explicit error. Bounded agent CLI lists use `gh issue list --limit <n>`. |
| issue view | `gh issue view --json number,title,body,author,labels,comments,url,state` |
| labels | `gh issue edit --add-label` / `--remove-label` |
| comments | `gh issue comment` / `gh pr comment` |
| change view | `gh pr view --json` includes current head/base OIDs, author, body, reviews/review decision and mergeability |
| merge state | allowlist `CLEAN`, `HAS_HOOKS`, `UNSTABLE`; any other or missing value refuses (required checks still enforced) |
| checks | JSON preflight `gh pr checks --required --json bucket,name`; an empty set refuses. Watch uses a separate plain `gh pr checks --required --watch --interval <s>` call because `gh` rejects combining `--watch` and `--json` (exit `8` = pending) |
| evidence | `gh api` checks manifest commit/tree and each artifact blob SHA/size |
| merge | `gh pr merge --squash/--merge/--rebase --delete-branch --match-head-commit <SHA>` (never `--admin`) |
| create | `gh pr create --head --base --title --body-file` |
| raw URL | `https://raw.githubusercontent.com/<project>/<ref>/<path>` |

## GitLab / Gitea (slots)

| Contract | GitLab (`glab`) | Gitea/Forgejo (`tea`) |
|---|---|---|
| account | `glab auth login` / config contexts | `tea login` |
| issues | `glab issue list -F json` | `tea issues --output json` |
| issue view | `glab issue view -F json` | `tea issues <n> --output json` |
| comments | `glab issue note` / `glab mr note` | `tea issues comment` |
| checks | `glab ci status` (map to `0/8/other`) | CI API |
| merge | `glab mr merge` | `tea pulls merge` |
| raw URL | `https://gitlab.com/<project>/-/raw/<ref>/<path>` | `https://<host>/<project>/raw/<ref>/<path>` |

The modules ship as explicit `NOT_IMPLEMENTED` stubs: selecting one fails loudly
with the missing methods instead of pretending to work.

## Adding a provider

1. Copy `scripts/providers/gitlab.mjs` to `scripts/providers/<name>.mjs`.
2. Implement every method above; map the provider's JSON fields to the contract.
3. Register it in `scripts/providers/index.mjs`.
4. Test `status`, `list`, `comment` and `checks` against a throwaway project
   before enabling a real one.
5. Add the mapping table to this reference — the skill text does not change.
