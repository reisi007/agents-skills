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
| `switchAccount(user)` | account name | selects the host CLI's active account |
| `listIssues({project, limit})` | project id | `[{number,title,author:{login},labels:[{name}],createdAt,updatedAt,url}]` |
| `viewIssue` | `{project, number}` | `{number,title,body,author:{login},labels,url,state,comments:[{author:{login},body,createdAt}]}` |
| `addLabel` / `removeLabel` | `{project, number, label}` | creates/removes the label on the issue |
| `comment` | `{project, number, body, kind}` | posts an issue (`kind: issue`) or change-request (`kind: change`) comment |
| `viewChange` | `{project, number}` | `{state, isDraft, url, headRefName, baseRefName, mergeable, mergeStateStatus, comments:[{author:{login},body}]}` |
| `checks` | `{project, number, required}` | exit-style status: `0` green, `8` pending, other = failed/unavailable |
| `merge` | `{project, number, method}` | merges with the mapped method; no bypass flag |
| `createChange` | `{project, head, base, title, bodyFile}` | opens the PR/MR, returns `{url, number}` |
| `ensureLabel` | `{project, name, color, description}` | creates or updates a label |
| `rawUrl` | `{project, ref, path}` | browsable raw URL for evidence artifacts |

Terminology: the interface says **change**; GitHub renders it PR, GitLab MR.

## GitHub (implemented)

| Contract | Implementation |
|---|---|
| account | `gh auth switch --user <user>` |
| issues | `gh issue list --json number,title,author,labels,createdAt,updatedAt,url` |
| issue view | `gh issue view --json number,title,body,author,labels,comments,url,state` |
| labels | `gh issue edit --add-label` / `--remove-label` |
| comments | `gh issue comment` / `gh pr comment` |
| change view | `gh pr view --json state,isDraft,url,headRefName,baseRefName,comments,mergeable,mergeStateStatus` |
| merge state | allowlist `CLEAN`, `HAS_HOOKS`, `UNSTABLE`; any other or missing value refuses (required checks still enforced) |
| checks | `gh pr checks --required` (exit `8` = pending) |
| merge | `gh pr merge --squash/--merge/--rebase --delete-branch` (never `--admin`) |
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
