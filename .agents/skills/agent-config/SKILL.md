---
name: Agent Config
description: 'TRIGGER when setting up a new machine/agent, wiring the global OpenCode config (opencode.jsonc, MCP servers, skills array), registering the central skills repo (agents-skills), or answering "how is my agent configured" / "where do my skills live" / "how do I add an MCP server".'
metadata:
  opencode/autoinvoke: false
---

# Agent Config — global setup, single source of truth

Everything about this developer's agent tooling: where config lives, how the
skills repo is registered, how MCP servers are wired, and how to bring a new
machine/project online.

> **Size note:** this file keeps decisions and wiring rules; verbatim config
> lives in `references/snippets.md`. Still over the ~150-line target — the
> overflow is the §1 commands wiring and the §2a/§8 wiring detail, which lose
> their force if shortened further.

## 1. Global config files

| File | Purpose |
|---|---|
| `~/.config/opencode/opencode.jsonc` | Global OpenCode config: permissions, agents, MCP servers, `skills` array |
| `~/.config/opencode/AGENTS.md` | Global agent instructions (CodeGraph usage block, …) |
| `~/dev/agents-skills/` | **Central skills repo** (GitHub `reisi007/agents-skills`) — the only home of own skills |
| `~/.agents/skills/` | Cross-agent compat source for third-party/official skills (daisyui, find-skills, opentui, reverse-engineer-anything) — NOT for own skills. Project-specific skills are **not** symlinked in here (symlinks for `blog-beitrag`/`testimonial` removed 2026-10-17): they are found through the project's own `.agents/skills/` and would otherwise load into every unrelated session. |
| `~/.config/opencode/commands/` | Slash commands: one file per command, `~/.config/opencode/commands/<name>.md`, filename = command name; body = prompt template, `$ARGUMENTS` = the argument string (templates do **not** expand `@path`). The **versioned source/template** for own commands lives in the repo under `.agents/commands/`; the machine files are **created by the agent** from those templates (a copy of the file contents), **not** by the user and **not** via symlink. Two own commands: `update-models` and `security-review`. New commands still appear only on explicit request (user rule 2026-10-17) — rare flows go through `/skills` (§7) instead. |

## 2. Skills repo registration (the `skills` array)

Own skills live in **one** git repo, not per project — the `skills` array
points at its `.agents/skills` directory (verbatim: `references/snippets.md`
§1). The structure follows the portable Agent Skills spec, so other agents
can consume the same dir.
- OpenCode also **auto-discovers** project-local `.agents/skills`,
  `.opencode/skills`, `.claude/skills` (compat) — but the convention here is:
  **no own skills inside projects**; everything own lives in agents-skills.
- Adding a new own skill: create `<agents-skills>/.agents/skills/<id>/SKILL.md`
  (frontmatter `name` + `description`, kebab-case ID = directory name), commit,
  push. No config change needed — the dir is already registered.
- Same ID in two sources: later source wins, so the repo entry wins over any
  leftover project copy (low → high: builtin → compat → global → project →
  `skills` array).

## 2a. Always-on rules — inlined into an `AGENTS.md`

A skill is **trigger-based**: its `description` has to match before its body is
read. That is the right mechanism for detail that is only needed sometimes, and
the wrong one for a rule that must hold in *every* session (e.g. the question
rule: every question to the user goes through the `question` tool). A rule that
lives only in a skill is a rule that gets skipped exactly when it is
inconvenient.

For those there is no config key in use: the global `opencode.jsonc` carries
**no `instructions` key**. The only way into a session is text **inlined into
an `AGENTS.md`** (global or project) — a rule file that is never inlined
delivers nothing (verbatim: `references/snippets.md` §2).

**What is actually always-on is rule text inlined into an `AGENTS.md`.** The
global `~/.config/opencode/AGENTS.md` carries the CodeGraph block, three
general working principles, the question rule and a short section with this
machine's host facts. The question rule there is the **short form** of the
duty; `ask.md` in `.agents/rules/` is its source and carries the reasoning. The
build/verify minimum is **not** in it — that flow reaches a session on demand
through a skill, whose `description` is the trigger.

- **The inline may be a short form — not a transcript.** The global `AGENTS.md`
  states the question duty in one line; the reasoning lives in `ask.md`. Judge
  drift by the **duty**, not by wording: a text diff against the source is **not**
  drift, and the short form must not be re-expanded to match the source.
- **Rule file = the versioned source, not the delivery path.** `.agents/rules/`
  holds the short, absolute minimum — one screen, no examples, no history;
  `.agents/skills/` carries the detail with reasoning, tables and evidence. The
  rule file points at the skill; it does not duplicate it.
- **Projects point at the rule file; they do not restate the flow.** A project's
  `AGENTS.md` defers to the skill and names `.agents/rules/build-verify.md` as the
  kernel, keeping only repo-specific commands — there is no copy of the rule text
  to keep in sync.
- **Adding an always-on rule** means inlining its text into an `AGENTS.md` (global
  or project): keep the source file in `.agents/rules/` and inline the text,
  because the file alone delivers nothing. A rule that is neither inlined nor
  covered by a skill's trigger **silently contributes nothing** — the failure to
  check for after a pull (§8).
- **Reloading:** like any config change, the running `opencode` service caches
  resolved config — `touch ~/.config/opencode/opencode.jsonc` or restart the
  session (see §3 for the same gotcha on MCP). Verify **once** after setup: in a
  fresh session the inlined text appears as `Instructions from: <path>` — the way
  the global `AGENTS.md` itself shows up in this session.
- **Do not scatter an always-on rule into an unversioned `AGENTS.md` as its only
  home** — the global `AGENTS.md` is not in this repo and not versioned with it.
  Keep the source file in `agents-skills`, versioned and reviewable, and inline
  its text; that is the whole point of the repo.

## 3. MCP servers

**codegraph is GLOBAL.** The global `~/.config/opencode/opencode.jsonc`
declares the codegraph MCP server once; every project (and any directory)
gets it automatically — no per-project MCP entry needed (verbatim:
`references/snippets.md` §3).

- Do **not** add a `codegraph` entry to project `opencode.json` files — the
  global one wins/merges anyway and a duplicate is redundant.
- Project-local MCP entries remain valid for **project-specific** servers
  (e.g. `nx-mcp` in `angular-material-extended/opencode.json`) — those stay
  per project.
- **Key rules (MCP availability):** the global MCP server is always
  reachable; but the `codegraph_*` tools only *return useful data* when the
  active project has a `.codegraph/` index (codegraph resolves the nearest
  index at/above the queried path). Without an index, use Read/Grep instead
  or run `codegraph init` in the project — see the `codegraph-project-setup`
  skill.
- **Context cost of the server's own playbook (measured 2026-10-17):** codegraph
  ships its agent guidance inside the MCP `initialize` response
  (`instructions`, `dist/mcp/server-instructions.js`: 6,833 B for
  `SERVER_INSTRUCTIONS`, 1,173 B for the `NO_ROOT_INDEX` variant) — roughly 6 KB
  in **every** session's system prompt, whether or not the project has an index.
  `codegraph serve --help` exposes only `--path/--mcp/--no-watch` and there is no
  env var, so it cannot be shortened from the config side; the upstream request is
  `colbymchenry/codegraph#765` (comment 2026-10-17). Patching the versioned
  install (`~/.codegraph/versions/<v>/…`) would be lost silently on the next
  update, and a wrapper in front of `codegraph serve --mcp` was considered and
  **rejected** (User-Entscheidung 2026-10-17).
- **Activation gotcha:** the running `opencode` service caches resolved
  configs. After changing the global `opencode.jsonc` or a project's
  `opencode.json`, trigger a reload with `touch
  ~/.config/opencode/opencode.jsonc` (the daemon watches the global dir) or
  restart the session — otherwise `opencode mcp list` keeps reporting the
  old state.
- Adding another MCP server: global ones go into the global
  `opencode.jsonc`; project-specific ones via
  `opencode mcp add <name> -- <command…>` in the project. Remote servers
  use `--url` instead of a command.

## 4. CodeGraph per project (quick reference)

For the full runbook see the `codegraph-project-setup` skill: `codegraph init`
(index + gitignore), commit the gitignore, install the hook from that skill's
`templates/pre-commit.sh`, `git config core.hooksPath .githooks`, then verify
(`codegraph status`, `git hook run pre-commit` → `codegraph: index synced`).
**Exception — `agents-skills` itself:** markdown only (skills, rules, docs), so
no index and no hook there; the hook was removed 2026-10-08. Do not run this
runbook against the skills repo.

Status commands: `codegraph status | sync | index | explore | upgrade`.

## 5. New machine / new project bring-up

- **New machine:** install codegraph CLI (`npm i -g @colbymchenry/codegraph`),
  clone `git@github.com:reisi007/agents-skills.git`, wire the `skills` array
  (§2) in the global `opencode.jsonc` (or symlink `~/.config/opencode/skills` →
  repo dir — that is the *skills* wiring only; commands are copied, not
  symlinked). No config key carries the always-on text (§2a) — it is inlined
  in the global `~/.config/opencode/AGENTS.md` (CodeGraph block, working
  principles, question rule, host facts). codegraph is declared once as a
  **global MCP server** (§3) — no per-project MCP entry for it.
  Create **both** own slash commands from the repo templates under
  `.agents/commands/` into `~/.config/opencode/commands/` (§1): create the
  directory, copy the template contents — the **agent** does this as part of the
  bring-up, the user does not, and **not** via symlink. Bootstrap work
  then loads `codegraph-project-setup` and `permissions` **by
  exact ID** (both are hidden, §7).
- **New project:** follow `codegraph-project-setup` (init + hook + AGENTS.md +
  AGENTS.todo.md) — load it **by exact ID** (hidden), as above. Do NOT create
  new skills in the project — add them to agents-skills instead.

## 6. Commit convention (agents-skills repo)

**Separate Conventional Commits are the default** — one per self-contained change
(`feat(skill): …`). Amend is the exception, and only while the commit is still
unpushed:

- amend only your own not-yet-pushed HEAD — a message wording, a forgotten file,
  a typo in what you just wrote;
- once pushed, it is history: a new commit instead, because an amend changes the
  SHA and other projects record those SHAs as their `skills-marker` range
  (see the `skills-marker` skill);
- the general flow allows one exception to "amend only unpushed": your own fresh
  pushed commit, replaced with `--force-with-lease` when the remote head is
  still exactly that commit and the replaced SHA is disclosed (conditions:
  `build-verify` skill, `references/amend.md`). **This repo does not take it** —
  its SHAs are other projects' `skills-marker` range, and a rewritten one leaves
  a dangling cursor there;
- if a force-push is ever unavoidable: `--force-with-lease`, never bare
  `--force` — it refuses to clobber remote state you haven't seen. That this
  repo is private/single-user is not the reason; the marker SHAs are;
- never `git add -A`: explicit paths plus `git show --stat`; **in a tree with parallel sessions, commit with the paths** — `git commit -- <path>` takes only the named paths, a bare `git commit` takes the whole index and with it another session's staged work; leave nothing of yours staged (rule file, Rule 4).
  The path-commit clause of rule 4 binds **every** session in a shared tree, and the responsibility is the **committer's**, not the neighbour's; no repo's branch policy overrides it.

This section is **not** an exception to the build/verify flow's rules — the
commit-per-task / push / watch-CI policy holds here unchanged. The `Verify:`
footer and the `nach-verify` flag apply as in every other repo.

## 7. Ownership rules (which skills live where)

| Skills | Location |
|---|---|
| Own skills (`ui-review`, `codegraph-project-setup`, `agent-config`, …) | `agents-skills/.agents/skills/` only |
| Rule files (`ask`, `build-verify`) | `agents-skills/.agents/rules/` only — always-on only where their text is inlined into an `AGENTS.md` (§2a) |
| Official/third-party packs installed by tools (daisyui, find-skills, stripe-*, …) | where the installer put them (`~/.agents/skills`, project `.agents/skills`, …) — not in agents-skills |
| Project-specific skills (nx-*, blog-beitrag, testimonial, …) | their project — not in agents-skills |

### Hidden skills — not advertised, loaded by exact ID

17 situational skills carry `metadata.opencode/autoinvoke: false`: they are **not**
in the model's advertised list, but stay registered and load by exact ID — pick
them in the `/skills` list, type `@<id>` in a prompt, or call the `skill` tool with
the exact ID. They are no longer exposed as `/<id>` slash commands by the skill
system (§1) — the repo's own command templates (`update-models`,
`security-review`) are separate files and stay. Reachable from here:

| ID | Trigger (one line) |
|---|---|
| `docker-test-image` | E2E/CI test image bakes the environment only; browser version from the lockfile |
| `generated-docs` | documentation generated from a source of truth and checked for drift |
| `ghcr-visibility` | job-level `container:` pull fails `unauthorized` / job dies exit 125 / package visibility |
| `laravel` | Laravel PHP backend conventions (11+, PHP 8.4+, JWT cookie, PHPUnit, Pint) |
| `node-deps` | pnpm dependency policy: no pins, ranges + lockfile |
| `playwright-parallel` | Playwright E2E parallelism: named locks, workers, shards instead of serial |
| `react-i18n` | German React+Vite UI with Lingui; extract/compile gate |
| `ratchet-gates` | quality gates as ratchets: monotonic baselines, fast/slow check tiers, docs generated from data |
| `security-review` | commissioned security review: enumerate surfaces, prove findings, close all in waves |
| `skills-marker` | per-project skills cursor `AGENTS.skills.md` (which commit was checked) |
| `tailscale-serve` | expose a local dev server on the tailnet via `tailscale serve` |
| `web-audit` | full live-site audit (SEO, images, performance) → self-contained archive |
| `codegraph-project-setup` | bootstrap CodeGraph (index + git hook) + project conventions |
| `permissions` | OpenCode permission policy: username isolation, secrets, `.env`, external_directory |
| `update-models` | stale model list, the models refresh/reload command, reviewing or updating the configured models, a model ID about to be written into `opencode.jsonc` (twin + capability gate) |
| `github-ci-filters` | GitHub Actions `paths`/`paths-ignore` filters; docs-only commits triggering CI; a PR stuck on a pending check (branch-protection trap) |
| `agent-config` | global OpenCode config: `opencode.jsonc`, MCP servers, `skills` array |

## 8. After pull: setup drift check

Every `git pull` (or fresh clone) in `agents-skills` can change what the local
machine needs. The repo is the source of truth; the machine is a copy that rots.
After pulling, diff what landed (`references/snippets.md` §5) and re-apply
setup if the source moved under you:

| Changed path | Setup step to re-check |
|---|---|
| `.agents/rules/*` (new) | nothing is auto-wired: the rule reaches a session only if its text is inlined into an `AGENTS.md` (global or project) or a skill trigger covers it — no config key carries it (§2a), so an inlined-nowhere rule **silently contributes nothing** |
| `.agents/rules/*` (changed content) | re-inline **only when the duty changed**, in the inline's own short form. The question rule (from `ask.md`) sits in the global `~/.config/opencode/AGENTS.md` as a deliberate short form, **not** a verbatim copy: a wording diff against `ask.md` is **not** drift, and re-expanding the short form to match the source is the mistake this row prevents. `build-verify.md` has no inline copy |
| `.agents/skills/*` (new skill) | nothing to wire (the dir is already registered) — but verify the skill resolves in a fresh session |
| `.agents/commands/*` (new, changed or removed) | re-create the machine copies in `~/.config/opencode/commands/` by copying the file contents; for a **removed** template, delete the orphaned machine file instead. The **agent** does this, the user does not — compare contents, not existence |
| `agent-config/SKILL.md` (§2/§2a/§3) | `skills` paths, the global `AGENTS.md` inline, or MCP wiring may have changed — apply locally |
| `.githooks/*`, README setup section | re-run the changed step (hook path, clone URL, install command) — **`.githooks/` no longer exists in this repo** (markdown-only, hook removed 2026-10-08): nothing to re-run, and do not re-create it |
| none of the above | nothing to do |

Then `touch ~/.config/opencode/opencode.jsonc` so the daemon picks the change up
(§2a reloading), and verify once in a fresh session. Report drift before applying:
the global config is user-owned — apply it, don't just announce it, but say what
changed and why. The repo-root `AGENTS.md` enforces this check whenever work
happens inside `agents-skills`, because a trigger-based skill alone would be
skipped exactly when it is inconvenient.
