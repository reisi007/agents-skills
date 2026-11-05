# Operations — CLI, exit codes, headless runs

All tracker access goes through `$SKILL_DIR/scripts/agent.mjs` and a provider
adapter. `jq` is not installed here; the CLI is Node and prints JSON for
machines. `SKILL_DIR` is the absolute skill directory reported by the `skill`
tool — set it once, because the workflow changes into `/tmp` worktrees.

## 1. CLI

```sh
node "$SKILL_DIR/scripts/agent.mjs" <command> [args] [--config <path>]
```

The provider CLI must already be installed, authenticated, and authorized. The
configured account is verified against the active CLI identity; the skill never
switches global credentials or extracts tokens. Git credentials for pushes must
also be configured. `--config <path>` isolates config/state, but not the shared
active-work lock under `GIT_ISSUE_AGENT_HOME`.

| Command | Purpose |
|---|---|
| `status` | config, model, projects, active lock, `last_run` (no writes) |
| `list [--project <p>] [--all-authors] [--limit <n>]` | open issues, trusted flag, queue order (`--limit`, default 100) |
| `view <project> <issue>` | issue body + comments with a `trusted` flag |
| `account <user> [--provider <p>]` | verify the active provider CLI account |
| `origin-check <project>` | verify fetch/push origin and URL rewrites before a branch push |
| `claim <project> <issue> [--branch <b>] [--owner-token <t>]` | create/continue the shared lock; continuation requires its owner token |
| `resume-lock <project> <issue> --confirm-stale` | rotate ownership after confirming the prior run stopped |
| `checkpoint <stage> --owner-token <t> [--change <n>] [--head <sha>] [--evidence <sha>]` | persist recovery stage and exact identities |
| `release [--result done\|blocked\|review\|needs-info\|none] --owner-token <t> [--force --confirm-stale]` | finish outcome-label writes, then clear owned lock; force is manual recovery only |
| `label <project> <issue> add\|remove <label>` | label write |
| `comment <project> <issue> --body-file <f> [--kind change]` | issue or change-request comment |
| `change-create <project> --head <b> --base <b> --title <t> --body-file <f> [--draft]` | open PR/MR |
| `checks <project> <number> [--watch] [--interval <s>]` | required-check status (`--interval`, default 10 s) |
| `merge <project> <number> --owner-token <t>` | verify SHA-bound review/evidence/tests/checks, then merge with expected head SHA |
| `evidence <project> <issue> --dir <dir> --owner-token <t>` | validate origin/content and publish a unique evidence commit/manifest |
| `ensure-labels [--project <p>]` | create/update lifecycle labels |
| `capture-model [--write]` | read the global OpenCode model; optionally store it |
| `set-model <provider/model>` | write `model` into the config, preserving comments |
| `help` | usage |

The first `claim` returns an owner token; protect it and any logs containing it.
Same-issue re-entry requires the exact token. A `flock` guard serializes
cross-process mutations, and lock/state files are atomically replaced. For a
crash, inspect the checkpoint and tracker/worktree state, then run
`resume-lock ... --confirm-stale` only after the previous process has stopped.
This rotates the token, but cannot revoke already-running raw Git commands.
`claim --force --confirm-stale` and `release --force --confirm-stale` are manual
recovery only; forced claim does not write cleanup labels. Normal release
requires successful label writes before clearing the lock; failures keep it
resumable. Release never writes to disabled projects. `review`, `blocked` and
`needs-info` keep an issue out of the next queue until a human removes the label.

## 2. Exit codes

| Code | Meaning |
|---|---|
| `0` | done / green |
| `1` | refused or failed (message on stderr, one line) |
| `2` | config missing or invalid |
| `8` | required checks still pending (`checks`) |

A scheduler treats anything non-zero as "look at the log", never as "retry
immediately".

## 3. Runbook

| Goal | Command |
|---|---|
| first setup | `/git-issue-agent setup`, then fill the reported config fields |
| one pass | `/git-issue-agent run` |
| inspect, no writes | `/git-issue-agent status` |
| stop a project | `/git-issue-agent pause owner/name` |
| allow it again | `/git-issue-agent resume owner/name` |
| model changed | `/git-issue-agent update` |

`setup` is non-interactive: it creates the folder/skeleton and exits; it never
uses the `question` tool and never guesses a missing field.

## 4. Failure handling

| Symptom | Action |
|---|---|
| stale lock | verify previous run stopped, then `resume-lock ... --confirm-stale`; clear only with explicit `release --force --confirm-stale` |
| auth missing | stop; the provider CLI must be logged in; no comment loop |
| red required checks | fix in scope; otherwise `blocked` + exact failing check |
| merge refused (behind / dirty / blocked / unknown state) | update the branch, re-run checks, never `--admin` |
| missing evidence | `blocked`; no merge, even if review approved |
| stale/untrusted marker or missing native review | re-review the exact head and obtain a new trusted GitHub approval |
| unsupported provider method | hard error; implement the adapter, never skip |

## 5. Evidence branches

The publisher verifies `origin` identifies the configured GitHub project, then
pushes to its canonical URL using normal Git credentials. It creates a unique
orphan evidence branch (no force-push), with a manifest binding project, issue,
PR, head SHA and artifact blob hashes. Comments use the evidence **commit SHA**,
so later changes cannot alter the referenced artifacts:

```sh
git push origin --delete agent-evidence-issue-<n>-head-<sha>-<suffix>
```

Do not put artifacts on the change-request branch; a squash merge would carry
them into the base branch.

## 6. Headless scheduling

The workflow is already unattended; schedule it outside the skill. Example
cron entry (verify `opencode run` flags on the installed version):

```cron
*/30 * * * * cd /projects/agents-skills && opencode run --auto --format json \
  'Load the skill git-issue-agent (exact ID: git-issue-agent) with the skill tool and execute mode run.' \
  >> "$HOME/.config/opencode/git-issue-agent/run.log" 2>&1
```

The shared lock makes overlapping timers harmless: a second invocation exits
before a tracker write. Keep logs private because the initial claim returns an
owner token. `flock` (util-linux) is required for cross-process serialization.

## 7. Markers

HTML comments are the machine-readable gate; they are invisible in rendered
markdown and portable across Git hosts:

| Marker | Required form | Enforced by |
|---|---|---|
| Triage | `<!-- git-issue-agent:triage -->` | duplicate comments are skipped |
| Evidence | `<!-- git-issue-agent:evidence head=<sha> issue=<n> pr=<n> commit=<sha> -->` | manifest identity and artifact hashes are checked |
| Review | `<!-- git-issue-agent:review-approved head=<sha> issue=<n> pr=<n> -->` | exact head plus native trusted GitHub approval |
| Tests | `<!-- git-issue-agent:tests head=<sha> issue=<n> pr=<n> -->` | exact head plus current required checks green |
| Blocked | `<!-- git-issue-agent:blocked -->` | human handoff |

Never post a marker you did not earn. Bare/old markers are rejected. Merge also
requires the latest GitHub review decision to be `APPROVED` and a trusted
reviewer (not the PR author) to have approved the exact head SHA.

## 8. Security boundaries

- The CLI rejects direct view/claim of untrusted issues; comments/repository text remain untrusted data.
- The skill is hidden (`opencode/autoinvoke: false`), so it is loaded by exact
  ID only.
- Common credential patterns and hidden files are rejected in comments/evidence. This cannot certify binary screenshots/videos; inspect them manually.
- `local_only` disables delegation and keeps code/build/artifact execution local; it does not attest model or tracker locality.
- `merge` uses GitHub's `--match-head-commit`; server-side branch protection remains required.

## 9. Self-test

`node "$SKILL_DIR/scripts/test-e2e.mjs"` runs synthetic CLI integration tests:
fake `gh`, a local bare Git remote and no network. It covers concurrent ownership,
stale-owner rotation, account identity checks, untrusted issues, config
isolation, merge refusals, SHA-bound review/evidence/checks, idempotent change
creation and evidence secret/remote guards. It does not run OpenCode, a model,
real GitHub, real screenshots or human review. CI runs it in `budget`; rerun it
after any CLI/adapter change.
