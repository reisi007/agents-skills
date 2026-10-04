# AGENTS.md — agents-skills

Central skills repo (`reisi007/agents-skills`). Conventions live in `README.md`;
global wiring is documented in the `agent-config` skill. This file holds only what
must apply while working **in this repo**.

## Commit convention

Amend + `--force-with-lease`, per `agent-config` §6. Exception: brand-new,
self-contained work (e.g. a new skill) gets its own Conventional Commit — the
history shows the pattern (`feat(skill): …`).

## Sprache

Dateien in diesem Repo sind **englisch** — Code, Kommentare, Doku, Skills, Regeln. Das gilt
für die Skills **in diesem** Repo; fremde Packs (`~/.agents/skills`, projektlokale
`.agents/skills` eines anderen Projekts) bleiben, wie ihre Autorinnen sie geschrieben haben,
und werden **nicht** übersetzt.

## Token-Disziplin

Dateien in diesem Repo landen im Kontext eines Modells — `rules/` als always-on, weil sie auf diesem Setup in die globale `AGENTS.md` inlined sind, sonst bei Bedarf wie ein Skill gelesen, `SKILL.md` erst bei passendem Trigger. Deshalb gilt eine Größenordnung als **Ziel, keine Mauer** — länger ist erlaubt, wenn der Inhalt es trägt und der Überlauf benannt ist:

| Ort | Ziel | wenn es darüber wächst |
|---|---|---|
| `.agents/rules/*.md` | **~60 Zeilen** | aufteilen, nicht polstern |
| `SKILL.md` | **~150 Zeilen** | Details wandern nach `references/` |
| `references/*.md` | ohne Ziel | Träger der Belege und Tabellen |

Gemessen wird mit `wc -l`. Wer länger wird, lagert den Überlauf nach `references/` aus und benennt, was wohin wanderte — „es wurde länger" allein zählt nicht. Eine Regel, die nur noch einen Verweis wiederholt, ist löschbar:
Was eine Entscheidung nicht ändert und was ein Link nicht schon sagt, gehört gestrichen, nicht
umformuliert.

## After pull: setup drift check

A `git pull` here can change what the local machine needs — the repo is the source
of truth, the machine is a copy that rots. After pulling, run the drift check from
`agent-config` §8 (rules dir vs. global `instructions`, skills registration, MCP
wiring, hooks) and re-apply setup locally. A new file under `.agents/rules/`
without a matching `instructions` entry in the global config **silently does
nothing** — that is the failure this check exists to catch.

## What does not belong here

- Project-specific skills — those live in their project (`agent-config` ownership
  table). Only own, portable skills and always-on rules live here.
- Third-party packs installed by tools — those stay where the installer put them.
