# Build-/Verify-Flow — immer gültig

Diese Datei wird über den `instructions`-Key der globalen OpenCode-Config in **jeder**
Session geladen (siehe `~/.config/opencode/opencode.jsonc`). Sie enthält nur das
nicht-verhandelbare Minimum. **Der ausführliche Ablauf mit allen Entscheidungstabellen
und Belegen steht im Skill `build-verify`** — bei jeder Umsetzung in einem Git-Repo
zuerst pullen, dann diesem Skill folgen. Projektspezifische Kommandos stehen in der
`AGENTS.md` des jeweiligen Repos, nicht hier.

## Die Regeln

1. **Vor der ersten Änderung pullen.** `git status --porcelain` zuerst. Bei dirty Tree
   **nicht** autostashen — nachfragen. Sonst `git pull --rebase`.
2. **Der Orchestrator schreibt keinen Code.** Implementierung an einen Subagenten
   delegieren. Ausnahme: kleine Edits an `AGENTS.md` / `AGENTS.todo.md`.
3. **Verifiziert wird immer von einem *anderen* Subagenten** als dem, der
   implementiert hat. Ein Verifikator zerstört niemals Implementierer-Arbeit mit
   `git checkout` / `git restore` / `git reset` auf Pfade mit uncommitteten Änderungen.
4. **Nach JEDEM Verify-Lauf wird committet — unabhängig vom Verdict.** Auch
   `CHANGES REQUIRED` wird committet, nicht erst `APPROVED`. **Ein Commit pro Task.**
   Niemals `git add -A` in einem geteilten Working Tree: immer explizite Pfade.
5. **Commit-Format:** Conventional Commits, plus Footer, der die Verify-Runden
   protokolliert (`Verify: Runde 1 CHANGES REQUIRED (2 Befunde)` / `Runde 2 APPROVED
   (behoben: …)`). Vor dem Commit `git show --stat` prüfen.
6. **Redo → `git commit --amend`.** Der Verifikator bekommt beim zweiten Lauf
   ausdrücklich `nach-verify: true` mit auf den Weg und meldet, welche Befunde der
   Vor-Runde behoben sind. Amend nur, solange HEAD der Verify-Commit **dieses** Tasks
   ist, nichts davon gepusht wurde und keine fremde Arbeit im Baum liegt. Sonst neuer
   Commit. `--amend` kann immer nur HEAD umschreiben, nie einen früheren Commit.
7. **Push + CI bis grün beobachten.** Einzige Ausnahme: der User hat ausdrücklich
   eine manuelle Verifikation angefordert — dann nicht pushen, die CI aber weiter
   beobachten, falls es eine gibt.
8. **Verifikationsläufe laufen sequenziell, nie parallel** (CPU-Überschreibung macht
   eine grüne Ampel ohne Aussagekraft).
9. **Verifiziert abgeschlossene TODOs werden aus `AGENTS.todo.md` entfernt** —
   nicht abgehakt, kein Erledigt-Bereich. Die Historie steht in den Commits.

## Ausnahme für dieses Repo

`agents-skills` selbst hat die spezifischere Regel aus `agent-config §6`: Änderungen
werden in den letzten Commit **amended** und mit `--force-with-lease` gepusht, nicht
pro Task einzeln committet. Das schlägt die Regel 4–7 für dieses eine Repo.