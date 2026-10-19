# agents-skills

**Personal agent skills (OpenCode & co.) — portable via the Agent Skills spec.**

Central, versioned repo for all **own** skills. No skill lives in a
single project anymore — this is the single source. Registered via the global
`skills` array in `~/.config/opencode/opencode.jsonc` → available in **every**
project.

## Structure

```
agents-skills/
├── .agents/rules/            ← rule files; always-on only where inlined into an `AGENTS.md`
│   ├── ask.md                ← questions: always via the question tool, answers suggested
│   └── build-verify.md       ← build/verify flow: non-negotiable core rules
├── .agents/commands/        ← versioned slash-command templates the agent copies into `~/.config/opencode/commands/`
├── .agents/skills/          ← Agent Skills spec structure (portable for OpenCode, Claude Code, …)
│   ├── agent-config/        ← global setup: opencode.jsonc, MCP, skills registration
│   ├── build-verify/        ← build/verify flow in detail: verifier, amend, commit schema
│   ├── codegraph-project-setup/  ← bootstrap: codegraph init + pre-commit hook + AGENTS.md
│   ├── docker-test-image/  ← E2E/CI test image: environment-only, browser version from the lockfile
│   ├── ghcr-visibility/  ← Container package visibility and pull authorisation: private-package pull failure, too-late login, PATCH-404 trap, fork PRs
│   ├── github-ci-filters/   ← GitHub Actions `paths-ignore`: docs-only commits skip the pipeline
│   ├── laravel/             ← Laravel PHP backend conventions (11+, PHP 8.4+, JWT cookie, PHPUnit, Pint)
│   ├── update-models/       ← live registry (opencode models, reload) + UPDATE/KEEP against the ocgo/cc price trackers
│   ├── node-deps/           ← pnpm dependency policy: no pins, ranges + lockfile
│   ├── permissions/         ← security policy: username isolation, secrets, macOS privacy, .env
│   ├── playwright-parallel/  ← Playwright E2E parallel instead of serial: named locks, workers, shards
│   ├── react-i18n/          ← German React+Vite UI with Lingui; extract/compile gate
│   ├── security-review/     ← commissioned security review: enumerate surfaces, prove findings, close all in waves
│   ├── skills-marker/  ← skills state per project (AGENTS.skills.md): which commit checked, which skills applied
│   ├── tailscale-serve/     ← expose local dev server to the tailnet via `tailscale serve`
│   ├── ui-review/           ← Playwright screenshot loop + vision analysis
│   └── web-audit/           ← full live-site audit (SEO, images, performance) → self-contained archive
```

Rules reach a session through `AGENTS.md` inlining, not the config's
`instructions` key — that array is empty on this setup.

## CI — skill budget

CI pins the context cost of the **advertised** skills: `activeSkills` (5),
`totalDescriptionChars` (2531) and `maxDescriptionChars` (918, the longest single
description in characters). The descriptions of advertised skills sit in every
session's system prompt, so that cost must not grow silently — hidden skills
(`opencode/autoinvoke: false`) are not counted. Run it locally with
`node scripts/skill-budget.mjs`. Raising a value is a deliberate change:
`node scripts/skill-budget.mjs --update` writes the current numbers into
`.github/skill-budget.json`, which the commit then has to justify.

## Installation / registration (once per machine)

```sh
git clone git@github.com:reisi007/agents-skills.git ~/dev/agents-skills

# ~/.config/opencode/opencode.jsonc
"skills": ["/Users/<user>/dev/agents-skills/.agents/skills"],
"instructions": [],   // empty: always-on text is inlined into AGENTS.md (see below)
```

The own slash commands are versioned as templates under `.agents/commands/`; the
**agent** copies their contents into `~/.config/opencode/commands/` — a manual
copy, no symlink (skill `agent-config` §1/§5). A `git pull` that adds, changes or
removes `.agents/commands/*` means the agent refreshes the machine copies (§8).

Afterwards available in **every** OpenCode session. Details & MCP CodeGraph:
see skill `agent-config`.

## Adding skills

```sh
# New skill
mkdir -p .agents/skills/<id>/
# SKILL.md with frontmatter (name + description), kebab-case ID = folder name
git add -A && git commit && git push
```

No config change needed — the directory is already registered.

Adding a **command** instead: create the template in `.agents/commands/<name>.md`
(frontmatter `description`, body loads the skill by exact ID, `$ARGUMENTS` at the
end), commit and push — then the **agent** copies it into
`~/.config/opencode/commands/` (§8 drift check). Only on explicit request
(user rule 2026-10-17).

For a rule that should hold in **every** session (not only on a trigger): keep the
file in `.agents/rules/` and inline its duty (short form) into an `AGENTS.md` (global or
project) — on this setup the config's `instructions` array is empty and delivers
nothing. Details in skill `agent-config`.

## Ownership rules

| Skills | Location |
|---|---|
| Own skills | **here** (`agents-skills/.agents/skills/`) |
| Rule files (always-on source) | **here** (`agents-skills/.agents/rules/`) |
| Own slash commands (source templates) | **here** (`agents-skills/.agents/commands/`) — the agent copies them into `~/.config/opencode/commands/` |
| Official/third-party packs (daisyui, find-skills, stripe-*) | where the installer puts them |
| Project-specific skills (nx-*, blog-beitrag, testimonial) | in the respective project |

## Repo decisions (rationale & history)

Why the rules in `AGENTS.md` read the way they do — kept out of that file on purpose.

- **Separate Conventional Commits; amend only unpushed.** Pushed commits are
  history: an amend changes the SHA, and other projects record these SHAs as their
  `skills-marker` range — a rewrite silently breaks their cursor.
- **Token discipline is a target, not a wall.** Files here land in a model's
  context, so size is measured with `wc -l`. Going over is allowed when the content
  carries it and the overflow is named and moved to `references/`.
- **After-pull setup drift check** exists because the repo is the source of truth
  and the machine is a copy that rots. The failure it catches: a rule file whose
  changed *duty* was not re-inlined into an `AGENTS.md` (the global config's
  `instructions` array is empty, so it delivers nothing) and a new skill that does
  not resolve.
- **Markdown-only, no CodeGraph.** The `codegraph sync` hook was removed
  2026-10-08 because it warned on every commit while indexing nothing. CodeGraph
  stays a per-*code*-project tool.

## Related

- `codegraph-project-setup` — CodeGraph index + hook for new projects
- `agent-config` — global agent configuration (single source of truth)

## License

Private — personal skills, not intended for sharing.
