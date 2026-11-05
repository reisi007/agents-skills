# Config — one folder, one queue, provider-neutral

Runtime directory: `~/.config/opencode/git-issue-agent/`

| File | Purpose |
|---|---|
| `config.jsonc` | provider, accounts, projects, trusted authors, labels, model, merge/evidence policy |
| `state.json` | runtime cursor (`active`, `last_run`); written by the CLI |
| `lock.json` | the **single global claim**; its existence means one issue is in flight |

Override the location for a test run: `GIT_ISSUE_AGENT_HOME`,
`GIT_ISSUE_AGENT_CONFIG` or `--config <path>`. A `--config` run keeps
`state.json` and `lock.json` **next to that config file**, so a test config can
never touch the live global queue. The CLI parses JSONC (comments and trailing
commas allowed) with Node — no `jq` on this host.

## Full example

```jsonc
{
  "version": 1,

  // Adapter key. GitHub is implemented; GitLab and others register here.
  "provider": "github",

  // One model for all subagents. Captured by `setup` / `update` from the
  // global OpenCode config (`agents.general.model`, else root `model`).
  "model": "opencode-go/deepseek-v4.1-flash-280k",

  // Accounts known to the selected provider's CLI.
  "accounts": ["reisi007"],

  // Binding authors: their issues are implemented, their comments are the
  // instructions. Everyone else is context only, never a command.
  "trusted_authors": ["reisi007"],

  "defaults": {
    "provider": "github",
    "enabled": true,
    "local_only": false,
    "auto_merge": true,
    "base_branch": "main",
    "labels": {
      "working": "agent:working",
      "review": "agent:review",
      "done": "agent:done",
      "blocked": "agent:blocked",
      "needs_info": "agent:needs-info"
    }
  },

  "evidence": {
    // Artifacts are force-pushed to `<prefix>-issue-<n>`, never merged.
    // There is no "required: false": no artifact means the issue is blocked.
    "branch_prefix": "agent-evidence"
  },

  // squash | merge | rebase (mapped by the adapter); never a merge bypass
  "merge": { "method": "squash" },

  "repos": {
    "reisi007/agents-skills": {
      "provider": "github",
      "account": "reisi007",
      "enabled": true,
      "local_only": true,
      "auto_merge": true,
      "base_branch": "main",
      "commands": { "build": "ratchet check", "test": "node --check .agents/skills/git-issue-agent/scripts/agent.mjs" }
    },

    "reisi007/portal.reisinger.pictures": {
      "provider": "github",
      "account": "reisi007",
      "enabled": false,          // explicit pause; `resume` flips it
      "local_only": true,       // build/test only on this machine
      "auto_merge": false,      // change request stays open for the human
      "base_branch": "main",
      "trusted_authors": ["reisi007"],
      "commands": { "build": "pnpm build", "test": "pnpm test" }
    }
  }
}
```

A GitLab project uses the same shape with `"provider": "gitlab"` and its
`group/project` id; only the adapter changes. See `references/providers.md`.

## Field semantics

| Field | Meaning |
|---|---|
| `provider` | adapter key (`github` implemented; others register in `scripts/providers/index.mjs`) |
| `accounts` | account names known to that provider's CLI; the project's `account` selects the active one |
| `trusted_authors` | global binding list; a project may override with its own array |
| `enabled` | `false` removes the project from discovery, replies, builds and merges |
| `local_only` | `true` forbids **any** remote execution/delegation; everything runs here |
| `auto_merge` | `true` lets the CLI merge after green required checks + both markers |
| `base_branch` | branch the change request targets and the "before" worktree starts from |
| `commands.build/test/lint` | optional overrides; otherwise use the project's `AGENTS.md` |
| `labels.*` | lifecycle names; `ensure-labels` creates/updates them |
| `merge.method` | `squash` (default), `merge`, `rebase`; mapped by the adapter |
| `model` | one model string for all subagents; no per-role entries |

`setup` fills the config; `update` re-reads the current model and refreshes
labels. `pause`/`resume` edit `enabled` with the `edit` tool — never rewrite the
whole JSONC file and lose its comments.

## Lock and state

`lock.json`:

```jsonc
{
  "provider": "github",
  "repo": "reisi007/portal.reisinger.pictures",
  "issue": 42,
  "branch": "fix/issue-42-login-redirect",
  "claimed_at": "2026-11-05T09:00:00.000Z",
  "local_only": true
}
```

`claim` refuses when a lock exists. `claim --force` is the forced takeover for a
stale/corrupt lock: it clears it, best-effort removes the previous issue's
`working` label and records the new claim. `release --force` clears the lock
without label cleanup when the config or project is gone. There is **no
age-based takeover**, so a long legitimate run is never stolen. `release` removes
the lock and sets the outcome label, so a crashed run cannot silently hold the
queue forever.

## Setup / update contract (non-interactive)

1. `mkdir -p ~/.config/opencode/git-issue-agent`.
2. Copy this example to `config.jsonc` only if the file does not exist; then
   exit with the list of fields the human must fill. **No question tool, no
   chat prompt** — the workflow is headless.
3. `node "$SKILL_DIR/scripts/agent.mjs" capture-model --write` — stores
   `agents.general.model` (else `agents.explore.model`, else root `model`) from
   `~/.config/opencode/opencode.jsonc`.
4. `node "$SKILL_DIR/scripts/agent.mjs" status` and `gh auth status` (or the
   provider's equivalent) for every account; `account <user>` switches per
   project.
5. `node "$SKILL_DIR/scripts/agent.mjs" ensure-labels` for enabled projects.
6. `node "$SKILL_DIR/scripts/agent.mjs" status` as the final proof.

`update` repeats steps 3 and 5 and validates the config; it never changes
project enablement.
