# agents-skills

**Personal agent skills (OpenCode & co.) — portable via the Agent Skills spec.**

Central, versioned repo for all **own** skills. No skill lives in a
single project anymore — this is the single source. Registered via the global
`skills` array in `~/.config/opencode/opencode.jsonc` → available in **every**
project.

## Structure

```
agents-skills/
├── .agents/rules/            ← always in context (inlined into global `AGENTS.md`)
│   ├── ask.md                ← questions: always via the question tool, answers suggested
│   └── build-verify.md       ← build/verify flow: non-negotiable core rules
├── .agents/skills/          ← Agent Skills spec structure (portable for OpenCode, Claude Code, …)
│   ├── agent-config/        ← global setup: opencode.jsonc, MCP, skills registration
│   ├── build-verify/        ← build/verify flow in detail: verifier, amend, commit schema
│   ├── codegraph-project-setup/  ← bootstrap: codegraph init + pre-commit hook + AGENTS.md
│   ├── docker-test-image/  ← E2E/CI test image: environment-only, browser version from the lockfile
│   ├── ghcr-visibility/  ← Container package visibility and pull authorisation: private-package pull failure, too-late login, PATCH-404 trap, fork PRs
│   ├── github-ci-filters/   ← GitHub Actions `paths-ignore`: docs-only commits skip the pipeline
│   ├── model-updater/       ← model recommendations against ocgo/cc price tracker (UPDATE/KEEP)
│   ├── permissions/         ← security policy: username isolation, secrets, macOS privacy, .env
│   ├── playwright-parallel/  ← Playwright E2E parallel instead of serial: named locks, workers, shards
│   ├── skills-marker/  ← skills state per project (AGENTS.skills.md): which commit checked, which skills applied
│   ├── tailscale-serve/     ← expose local dev server to the tailnet via `tailscale serve`
│   ├── update-opencode-models/ ← live registry: opencode models, reload, free/paid prefixes
│   ├── vision-agents/       ← locked-down vision subagent (creative) + escalation rule
│   └── ui-review/           ← Playwright screenshot loop + vision analysis
```

Always-on rules are inlined into the global `~/.config/opencode/AGENTS.md`,
loaded in every session; the `instructions` entry stays in the config as the
intended mechanism for when it works.

## Installation / registration (once per machine)

```sh
git clone git@github.com:reisi007/agents-skills.git ~/dev/agents-skills

# ~/.config/opencode/opencode.jsonc
"skills": ["/Users/<user>/dev/agents-skills/.agents/skills"],
"instructions": ["/Users/<user>/dev/agents-skills/.agents/rules/build-verify.md"],
```

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

For a rule that should **always** be in context (not only on a trigger):
place the file in `.agents/rules/` and add the path to the `instructions` array
of the global config. Details in skill `agent-config`.

## Ownership rules

| Skills | Location |
|---|---|
| Own skills | **here** (`agents-skills/.agents/skills/`) |
| Always-loaded rules | **here** (`agents-skills/.agents/rules/`) |
| Official/third-party packs (daisyui, find-skills, stripe-*) | where the installer puts them |
| Project-specific skills (nx-*, blog-beitrag, testimonial) | in the respective project |

## Related

- `codegraph-project-setup` — CodeGraph index + hook for new projects
- `agent-config` — global agent configuration (single source of truth)
- `build-verify` — build/verify flow: pull, delegate, verify, commit, amend, push

## License

Private — personal skills, not intended for sharing.
