# Build-/Verify-Flow — immer gültig

Diese Datei wird über den `instructions`-Key der globalen OpenCode-Config in **jeder**
Session geladen (siehe `~/.config/opencode/opencode.jsonc`). Sie enthält nur das
nicht-verhandelbare Minimum. Projektspezifische Kommandos stehen in der
`AGENTS.md` des jeweiligen Repos, nicht hier.

## Die Regeln

0. **Alles, was über die Kleinigkeits-Ausnahme hinausgeht, geht durch den vollen
   Loop** — und der volle Loop steht im Skill **`build-verify`**: vor der ersten
   Änderung in einem Git-Repo diesen Skill laden, nicht nur diese Datei lesen.
   Auslöser: mehr als eine Datei, Code/Logik/Test/Build/Dependency, ein Config-Schlüssel
   mit Wirkung **nach Abzug der Ausnahme**, Diff über 30 Zeilen (add + del, über den
   gesamten Task), jede neue Regel oder geänderte Pflicht/Schwelle/Ausnahme. Diese
   Datei allein trägt nur das Minimum an
   Kommandos — **keine ausführlichen Abläufe, keine Entscheidungstabellen**; Rollen,
   Verifikator-Prompt und Amend-Entscheidung stehen im Skill, Traps und
   Begründungen in dessen `references/notes.md`.
1. **Vor der ersten Änderung pullen.** `git status --porcelain` zuerst. Bei dirty Tree
   **nicht** autostashen — nachfragen. Sonst `git pull --rebase`.
2. **Der Orchestrator schreibt keinen Code.** Implementierung an einen Subagenten
   delegieren. **Einzige Ausnahme: die Kleinigkeits-Ausnahme** (Abschnitt unten) —
   alles, was auch nur entfernt Zweifel aufkommen lässt,
   wird delegiert.
3. **Verifiziert wird immer von einem *anderen* Subagenten** als dem, der
   implementiert hat — außer bei der Kleinigkeits-Ausnahme, dann prüft der
   Orchestrator selbst. Ein Verifikator zerstört niemals Implementierer-Arbeit mit
   `git checkout` / `git restore` / `git reset` auf Pfade mit uncommitteten Änderungen.
4. **Nach JEDEM Verify-Lauf wird committet — unabhängig vom Verdict.** Auch
   `CHANGES REQUIRED` wird committet, nicht erst `APPROVED`. **Ein Commit pro Task.**
   Niemals `git add -A` in einem geteilten Working Tree: immer explizite Pfade. Wo es
   keinen Verify-Lauf gibt (Kleinigkeits-Ausnahme), gilt derselbe
   Commit-Pflichtsatz ohne Lauf.
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

## Kleinigkeits-Ausnahme (2026-10-03, User-Entscheidung)

Der Orchestrator macht Kleinigkeiten **selbst** — der Loop mit Implementierer und
Verifikator ist das Größere. **Alle vier Kriterien gleichzeitig** (Herleitung,
Beispiele und Beleg in `~/dev/agents-skills/.agents/skills/build-verify/references/notes.md`):

1. **Eine bestehende** Datei (keine neue, keine gelöschte), Diff **≤ 30 Zeilen**
   (add + del, hart: 31 = raus), gemessen über den **gesamten** Task. Wird die
   Schwelle unterwegs gerissen, gilt ab da der volle Loop.
2. Nur Text: Doku, Kommentar, Formatierung, **bestehender** Config-Schlüssel mit neuem
   Wert — kein neuer Schlüssel, kein Identifier-Rename (Doku, die einen Namen
   *präzisiert*, bleibt drin), keine Logik, kein Control-Flow, keine
   API-/Signaturänderung, keine Migration.
3. Keine Dependency-, Lockfile-, Build-, Test- oder Schemaänderung, kein
   Dependency-Manager-Kommando (`pnpm add`, `npm i`, `pip install`, …).
4. Keine inhaltlich neue Regel oder Prozessentscheidung — auch nicht als reiner Text.
   Regel-/Skill-Änderungen laufen durch den vollen Loop, ein Tippfehler darin nicht.
   Ebenso raus: Pflicht, Schwelle oder Ausnahme einer **bestehenden** Regel ändern.

**Bleibt unverändert:** pullen (1), Conventional Commit mit expliziten Pfaden und
`git show --stat` (4/5), Push + CI (7). Footer dann als `Verify: entfällt
(Kleinheits-Ausnahme, 0 Runden)` — nicht weglassen, sonst ist später nicht mehr
unterscheidbar, ob ein Lauf stattgefunden hat. **Entfällt:** Implementierer,
Verifikator, `nach-verify`-Runden und der Amend **aus dem Verify-Redo-Pfad** (die
repo-spezifische Amend-Regel unten bleibt unberührt). Der Orchestrator prüft selbst,
mit den Kommandos aus der Repo-`AGENTS.md`, die unter einer Minute laufen (`git diff`
lesen, Lint/Typecheck, Test der betroffenen Stelle). **Kein `AGENTS.todo.md`-Eintrag**
außer bei einer echten Entscheidung — die Pflicht aus den globalen Arbeitsregeln
gilt unverändert, der Kleinkram darunter nicht. **Bei Zweifel: delegieren.** Der Test
ist nicht „ist es leicht“, sondern „ist es eindeutig unter der Schwelle“ — zwei Runden
für einen billigen Task sind billiger als ein Feature mit einem stillen Fehler.

## Ausnahme für dieses Repo

`agents-skills` selbst hat die spezifischere Regel aus `agent-config §6`: Änderungen
werden in den letzten Commit **amended** und mit `--force-with-lease` gepusht, nicht
pro Task einzeln committet. Das schlägt die Regel 4–7 für dieses eine Repo.