# agents-skills

**Persönliche Agent-Skills (OpenCode & Co.) — portabel über die Agent-Skills-Spec.**

Zentrales, versioniertes Repo für alle **eigenen** Skills. Kein Skill lebt mehr
in einem Einzelprojekt — hier ist die einzige Quelle. Registriert via globalem
`skills`-Array in `~/.config/opencode/opencode.jsonc` → verfügbar in **jedem**
Projekt.

## Struktur

```
agents-skills/
├── .agents/skills/          ← Agent-Skills-Spec-Struktur (portabel für OpenCode, Claude Code, …)
│   ├── agent-config/        ← Globales Setup: opencode.jsonc, MCP, Skills-Registrierung
│   ├── codegraph-project-setup/  ← Bootstrap: codegraph init + Pre-Commit-Hook + AGENTS.md
│   ├── model-updater/       ← Modell-Empfehlungen gegen ocgo/cc Preis-Tracker (UPDATE/KEEP)
│   └── ui-review/           ← Playwright-Screenshot-Loop + Vision-Analyse
└── .githooks/pre-commit     ← CodeGraph-Index-Sync vor jedem Commit (fails open)
```

## Installation / Registrierung (einmalig pro Maschine)

```sh
git clone git@github.com:reisi007/agents-skills.git ~/dev/agents-skills

# ~/.config/opencode/opencode.jsonc
"skills": ["/Users/<user>/dev/agents-skills/.agents/skills"],
```

Danach in **jeder** OpenCode-Session verfügbar. Einzelheiten & MCP-CodeGraph:
siehe Skill `agent-config`.

## Skills erweitern

```sh
# Neuer Skill
mkdir -p .agents/skills/<id>/
# SKILL.md mit Frontmatter (name + description), kebab-case-ID = Ordnername
git add -A && git commit && git push
```

Keine Config-Änderung nötig — das Verzeichnis ist bereits registriert.

## Ownership-Regeln

| Skills | Ort |
|---|---|
| Eigene Skills | **hier** (`agents-skills/.agents/skills/`) |
| Offizielle/Third-Party-Packs (daisyui, find-skills, stripe-*) | dort, wo der Installer sie platziert |
| Projekt-spezifische Skills (nx-*, blog-beitrag, testimonial) | im jeweiligen Projekt |

## Verwandt

- `codegraph-project-setup` — CodeGraph-Index + Hook für neue Projekte
- `agent-config` — globale Agent-Konfiguration (Single Source of Truth)

## License

Private — persönliche Skills, nicht zur Weitergabe gedacht.