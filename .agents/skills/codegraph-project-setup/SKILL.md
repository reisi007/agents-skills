---
name: CodeGraph Project Setup
description: TRIGGER when scaffolding a new project/repo, when starting work in a repository without a `.codegraph/` directory, or when the codegraph MCP tools (codegraph_explore) report unavailable. Run to bootstrap CodeGraph (index + git integration + MCP readiness) plus the standard project conventions (AGENTS.md, build-agent rules).
---

# CodeGraph Project Setup — new-project bootstrap runbook

Every project gets a CodeGraph index **at scaffold time**, wired into git, so the
MCP codegraph tools work immediately and the index stays fresh:

1. `codegraph init` → `.codegraph/` index + `.codegraph/.gitignore` (index stays out of git)
2. `.githooks/pre-commit` + `core.hooksPath` → index refresh before every commit (fails open)
3. `opencode2 mcp add codegraph -- codegraph serve --mcp` → per-project `opencode.json` (MCP, §2.6)
4. `AGENTS.md` + `AGENTS.todo.md` → project conventions incl. build-agent rules
5. Skill registration → available in every project, not just the one holding it

## 1. Why per-project init is required (MCP availability)

- MCP servers are configured **per project** — there is **no global MCP
  config** (`~/.config/opencode/opencode.jsonc` has no `mcp` section). Each
  project that wants the codegraph MCP tools declares the server in its own
  `opencode.json`:
  `cd <project> && opencode2 mcp add codegraph -- codegraph serve --mcp`
  (writes `mcp.servers.codegraph` into `<project>/opencode.json`; `--global`
  would write the global config instead).
- The MCP tools (`codegraph_explore` …) only work when the **active project**
  has **both**: a `.codegraph/` index **and** the per-project `opencode.json`
  MCP entry. Missing either ⇒ the tools report unavailable and agents silently
  fall back to grep/read.
- **Activation gotcha:** the running `opencode2` service caches resolved
  per-project configs and does NOT watch project `opencode.json` files. After
  adding/changing one, trigger a reload via `touch ~/.config/opencode/opencode.jsonc`
  (the daemon watches the global dir) or restart the opencode session —
  otherwise `opencode2 mcp list` still reports "No MCP servers configured".
- ⇒ **Project readiness == `codegraph init` + per-project MCP add executed.**
  Do it during scaffolding, not "sometime later". Verify in a fresh session
  that the `codegraph_*` tools are listed.

## 2. Runbook

### 2.1 Git repo

- Ensure a git repo exists (`git init` if needed); caught up git history helps
  the index's change detection but is not a prerequisite.

### 2.2 CodeGraph index

1. From the repo root: `codegraph init`
   - Creates `.codegraph/` with `codegraph.db`, daemon files, logs **and** the
     tracked-able `.codegraph/.gitignore` (`*` + `!.gitignore`) that keeps all
     index artifacts out of git.
2. Commit the ignore file so every clone stays clean:
   `git add .codegraph/.gitignore && git commit -m "chore: codegraph index gitignore"`
3. Verify: `codegraph status` (Files/Nodes populated) and
   `codegraph explore "main"` returns source.

### 2.3 Pre-commit hook (index freshness)

1. `mkdir -p .githooks` and copy the canonical hook from this skill's
   `templates/pre-commit.sh`:
   `cp <skills-repo>/.agents/skills/codegraph-project-setup/templates/pre-commit.sh .githooks/pre-commit`
   then `chmod +x .githooks/pre-commit`.
2. `git config core.hooksPath .githooks` (local config — set once per clone).
3. Verify: `git hook run pre-commit` → prints `codegraph: index synced`, exit 0.
4. **Design: fails open.** Missing CLI or sync error ⇒ warning to stderr, exit 0.
   Index freshness is a convenience, not a commit gate (matches codegraph's own
   hook design: "never block git"). Repos without a `.codegraph/` index (e.g.
   doc/markdown-only repos) skip the sync silently via a `[ -d "$repo_root/.codegraph" ]` guard.
5. Do **not** use codegraph's built-in post-* hook installer
   (`installGitSyncHook` for `post-commit`/`post-merge`/`post-checkout`): it
   writes into `.git/hooks/`, which git **ignores** once `core.hooksPath` is set.
   If post-hooks are ever needed (e.g. WSL2 without file watcher), write them as
   versioned files into `.githooks/` instead.

### 2.4 Project conventions (AGENTS.md / AGENTS.todo.md)

- Create `AGENTS.md` — copy the structure of `portal.reisinger.pictures/AGENTS.md`
  (§1–§11) and adapt the module-specific sections. Keep the strict parts:

  - **Language:** code & docs EN, UI DE (mixed German terms in docs allowed).
  - **DoD — tests exist:** backend → PHPUnit Feature/Unit; frontend logic →
    Vitest; UI/components → Playwright E2E. Bug fixes need at least one
    regression test. Refactorings may skip tests but must justify in the commit.
  - **Quality gates:** `pnpm lint:fix` (never plain `lint`), `pnpm build` /
    `tsc -b`, `php artisan test`; no `any` / `@ts-ignore` / `eslint-disable`;
    safe patching (validate every search/replace before applying); zero
    pre-existing failures; max 3 fix attempts, then hand back to the user.
  - **Docs:** `features/` = permanent SOLL state (architecture, data models, API
    contracts); `AGENTS.todo.md` = temporary tasks, review notes, session
    tracking. Every feature needs actionable TODOs incl. test-writing TODOs.
  - **E2E tagging:** every E2E test carries `{ tag: [...] }` — `@smoke` on the
    critical path, `@regression` before deploy, `@feature:<name>` for
    feature-specific selection.
  - **Build-agent rules (STRICT, established 2026-07-31, not to be bypassed):**
    the build agent is **orchestrator only**. It may read/edit only `AGENTS.md`
    and `AGENTS.todo.md` (plus tiny typo/policy fixes in those files). Every
    other file MUST be delegated to subagents — implementation goes to the
    `general` subagent (never to `build`). Delegate independent tasks in
    parallel when sensible; a **separate** subagent verifies each
    implementation (verifier ≠ implementer); use the `vision` subagent for
    visual/layout/screenshot checks.

- Create `AGENTS.todo.md` task board (temporary, header pattern: "Stand: <date>.
  Nur offene TODOs.").

### 2.5 Skill availability for new projects

- This skill is versioned in the central skills repo
  `agents-skills/.agents/skills/codegraph-project-setup/` (GitHub:
  `reisi007/agents-skills`) and registered **globally** via the `skills` array
  in `~/.config/opencode/opencode.jsonc` (absolute path to
  `<agents-skills>/.agents/skills`), so it is advertised in every project —
  including freshly scaffolded ones. See the `agent-config` skill for how the
  global registration is wired up.
- Fallback if the global entry is missing: clone `git@github.com:reisi007/
  agents-skills.git` and add its `.agents/skills` dir to the global `skills`
  array, or copy this folder into the new project's `.opencode/skills/` /
  `.agents/skills/` — project skills under `.agents/skills/` are
  auto-discovered (no config entry needed), ID = directory name.

### 2.6 Per-project MCP server (`opencode.json`)

1. From the repo root:
   `opencode2 mcp add codegraph -- codegraph serve --mcp`
   - Writes/merges `<project>/opencode.json` with `mcp.servers.codegraph`
     (`type: "local"` + `command`). The flat `mcp.<name>` form is also read —
     the CLI writes the `servers` wrapper.
2. Commit `opencode.json`:
   `git add opencode.json && git commit -m "chore(opencode): add per-project codegraph MCP server"`
3. **Activate:** the running `opencode2` service caches per-project configs and
   does not watch project files — run `touch ~/.config/opencode/opencode.jsonc`
   (daemon watches the global dir, reloads all project configs) or restart the
   opencode session.
4. Verify: `opencode2 mcp list` → `✓ codegraph connected`; in a fresh session
   the `codegraph_*` tools are listed.

## 3. Verification checklist

- [ ] `codegraph status` shows Files/Nodes (not empty)
- [ ] `git hook run pre-commit` prints `codegraph: index synced`; PATH without
      codegraph warns and still exits 0
- [ ] `git status` shows `.codegraph/.gitignore` as the only new file below
      `.codegraph/` (DB/logs/daemon files must NOT appear)
- [ ] `core.hooksPath` = `.githooks` (`git config --get core.hooksPath`)
- [ ] `git ls-files opencode.json` non-empty; `opencode2 mcp list` shows
      `✓ codegraph connected` (after the `touch` activation from §2.6)
- [ ] In a fresh OpenCode session the `codegraph_*` MCP tools are listed for
      this project
- [ ] Commit 1: `.codegraph/.gitignore`; Commit 2: `.githooks/`, `AGENTS.md`,
      `AGENTS.todo.md`; Commit 3: `opencode.json`

## 4. Maintenance

- CodeGraph CLI: `codegraph status | index | sync | explore | upgrade`.
  Upgrade restores the MCP registration (`codegraph upgrade` re-runs the
  installer refresh automatically).
- The per-project MCP config lives in the project's `opencode.json` (added via
  `opencode2 mcp add`, see §2.6) — touch it only if the server command or a
  flag changes; after any change, activate via
  `touch ~/.config/opencode/opencode.jsonc` or a session restart.