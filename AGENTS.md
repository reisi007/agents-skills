# AGENTS.md — agents-skills

Central skills repo (`reisi007/agents-skills`). Conventions live in `README.md`;
global wiring is documented in the `agent-config` skill (hidden — load it by
exact ID). This file holds only what must apply while working **in this repo**.

**Rules only, no decisions:** This file contains rules only — instructions that
apply to any work in this repo. Durable decisions, rationale, measurements and
history do not belong here but in `README.md`/`.agents/rules/`; open work goes to
`AGENTS.todo.md`, settled matters to git history.

## Commit convention

One Conventional Commit per self-contained change (`feat(skill): …`) is the
default; amend only while the commit is still **unpushed** (message wording, a
forgotten file). `git add -A` is never used — explicit paths plus
`git show --stat`.

## Sprache

Dateien in diesem Repo sind **englisch** — Code, Kommentare, Doku, Skills, Regeln.
Fremde Packs (`~/.agents/skills`, projektlokale `.agents/skills` eines anderen
Projekts) bleiben, wie ihre Autorinnen sie geschrieben haben, und werden **nicht**
übersetzt.

## Token-Disziplin

Dateien in diesem Repo landen im Kontext eines Modells — `rules/` nur, wo ihr Text
wirklich geliefert wird (inlined in eine `AGENTS.md`, global oder im Projekt), sonst
bei Bedarf wie ein Skill gelesen, `SKILL.md` erst bei passendem Trigger. Die
Größenordnung ist ein **Ziel, keine Mauer** — länger ist erlaubt, wenn der Inhalt es
trägt und der Überlauf benannt ist:

| Ort | Ziel | wenn es darüber wächst |
|---|---|---|
| `.agents/rules/*.md` | **~60 Zeilen** | aufteilen, nicht polstern |
| `SKILL.md` | **~150 Zeilen** | Details wandern nach `references/` |
| `references/*.md` | ohne Ziel | Träger der Belege und Tabellen |

Gemessen wird mit `wc -l`; Überlauf wandert nach `references/` und wird benannt
(was wohin). Eine Regel, die nur noch einen Verweis wiederholt, ist löschbar.

## After pull: setup drift check

After pulling, run the drift check from the hidden skill `agent-config` (load it
by exact ID) §8 (rule files vs. the text inlined into `AGENTS.md`, skills
registration, command templates, MCP wiring, hooks) and re-apply setup locally.

## Markdown-only — no CodeGraph here

This repo holds skills and docs (markdown), no code: **no `.codegraph/` index and
no pre-commit hook**. Do not re-add the hook or run `codegraph init` here.
CodeGraph remains a per-*code*-project tool (`codegraph-project-setup` skill).

## What does not belong here

- Project-specific skills — those live in their project (`agent-config` ownership
  table; hidden skill, load by exact ID). Only own, portable skills and rule
  files live here.
- Third-party packs installed by tools — those stay where the installer put them.
