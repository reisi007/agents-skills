---
name: CodeGraph Project Setup
description: TRIGGER when scaffolding a new project/repo, or when starting work in a repository without a `.codegraph/` directory. Run to bootstrap CodeGraph (index + git integration) plus the standard project conventions (AGENTS.md, build-agent rules).
---

# CodeGraph Project Setup — new-project bootstrap runbook

Every project gets a CodeGraph index **at scaffold time**, wired into git, so the
CLI tools work immediately and the index stays fresh:

1. `codegraph init` → `.codegraph/` index + `.codegraph/.gitignore` (index stays out of git)
2. `.githooks/pre-commit` + `core.hooksPath` → index refresh before every commit (fails open)
3. `AGENTS.md` + `AGENTS.todo.md` → project conventions incl. build-agent rules
4. Skill registration → available in every project, not just the one holding it

## 1. Why per-project init is required

- CodeGraph is used exclusively via the **CLI** (`codegraph explore`,
  `codegraph status`, `codegraph sync`). There is no MCP server component —
  the `codegraph` binary must be on `PATH`.
- The CLI works in any repository that has a `.codegraph/` index. Missing the
  index ⇒ `codegraph explore` reports "no index" and the agent falls back to
  grep/read.
- ⇒ **Project readiness == `codegraph init` + pre-commit hook.** Do it during
  scaffolding, not "sometime later".

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

## 3. Verification checklist

- [ ] `codegraph status` shows Files/Nodes (not empty)
- [ ] `git hook run pre-commit` prints `codegraph: index synced`; PATH without
      codegraph warns and still exits 0
- [ ] `git status` shows `.codegraph/.gitignore` as the only new file below
      `.codegraph/` (DB/logs/daemon files must NOT appear)
- [ ] `core.hooksPath` = `.githooks` (`git config --get core.hooksPath`)
- [ ] Commit 1: `.codegraph/.gitignore`; Commit 2: `.githooks/`, `AGENTS.md`,
      `AGENTS.todo.md`

## 4. Maintenance

- CodeGraph CLI: `codegraph status | index | sync | explore | upgrade`.
- The `.codegraph/` index is maintained by the pre-commit hook and the
  codegraph daemon. No additional configuration files are needed.
