# Build-/Verify-Flow — immer gültig

Diese Datei wird über den `instructions`-Key der globalen OpenCode-Config in **jeder**
Session geladen (siehe `~/.config/opencode/opencode.jsonc`). Sie enthält nur das
nicht-verhandelbare Minimum. Projektspezifische Kommandos stehen in der
`AGENTS.md` des jeweiligen Repos, nicht hier.

## Geltungsbereich — der Flow ist ein Commit-Flow

Dieser Flow startet, wenn in einem Git-Repo etwas **committet** werden soll: ein
Feature, ein Fix, eine Doku-Änderung, eine beauftragte TODO-Abarbeit. Ab dem ersten
Byte der Änderung — und nur auf Auftrag.

**Kein Flow, sondern normale Interaktion:** recherchieren, Code oder Doku lesen,
eine Nachfrage beantworten, einen Skill nachschlagen, Code-Verhalten erklären, eine
Annahme testen, ein Kommando oder einen Config-Wert **ausprobieren**, ein offenes
TODO **ansehen**. Dort wird nichts delegiert, nichts verifiziert, nicht gepullt,
nichts committet — das Ergebnis ist Beweismaterial für die spätere Entscheidung, kein
Arbeitsstand. Aus dem reinen Prüfen entsteht kein TODO-Eintrag; eine tatsächlich
getroffene Entscheidung wird geloggt (siehe unten). Sobald daraus eine Änderung wird,
die committet werden soll, gilt dieser Flow. Auch ein Experiment über mehrere Dateien
bleibt außerhalb des Flows, solange es nicht committet wird. Wird es behalten, gilt der
Flow ab dem Moment der Entscheidung — Regel 1 wird dann sofort nachgezogen.

Zwei Dinge bleiben auch beim Ausprobieren unberührt: die Berechtigungen aus
`~/.config/opencode/opencode.jsonc` (Secrets, fremde Home-Verzeichnisse, `.env`) und
der Tree eines laufenden Kollegen — „nur ausprobieren" heißt nie `git checkout .` auf
fremder Arbeit.

## `AGENTS.todo.md` ist ein Log, kein Auftrag

**Anlegen bleibt Pflicht** — jede getroffene Entscheidung wird eingetragen
(globale Arbeitsregeln). **Abarbeiten nicht:** die Umsetzung eines Todo-Eintrags
startet **nur auf ausdrücklichen Auftrag** des Users. Die Datei ist ein Protokoll
der Entscheidungen, kein Arbeitsauftrag, und ihre Länge ist kein Auftrag. Wer sie
abarbeitet, ohne dazu beauftragt worden zu sein, erfindet sich Aufgaben.

Daraus folgt für den Flow: ein TODO-Eintrag löst **keinen** Verify-Lauf aus. Erst
der Auftrag, dann Regel 0. Regel 9 gilt unverändert: verifiziert abgeschlossene Einträge werden entfernt — das Log ist das Protokoll der offenen und der verworfenen Entscheidungen, kein Vollarchiv.

## Die Regeln

0. **Soll committet werden und es ist mehr als Kleinigkeit, geht es durch den vollen
   Loop** — und der volle Loop steht im Skill **`build-verify`**: vor der ersten
   Änderung in einem Git-Repo diesen Skill laden, nicht nur diese Datei lesen.
   Auslöser: mehr als 5 Dateien, mehr als ~80 Diff-Zeilen (add + del, über den
   gesamten Task), Code/Logik/Test/Build/Dependency/Schema, ein Config-Schlüssel, den
   Anwendungscode liest, jede neue Regel oder
   geänderte Pflicht/Schwelle/Ausnahme. Diese Datei allein trägt nur das Minimum an
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

## Kleinheits-Ausnahme

Der Orchestrator macht Kleinigkeiten **selbst** — der Loop mit Implementierer und
Verifikator ist das Größere. **Alle vier Kriterien gleichzeitig** (Herleitung,
Beispiele und Beleg in `~/dev/agents-skills/.agents/skills/build-verify/references/notes.md`):

1. **Bis zu 5 Dateien** (neu, geändert oder gelöscht), Diff **~80 Zeilen** (add + del),
   gemessen über den **gesamten** Task (Messkommando: `git diff --shortstat`, Insertions + Deletions).
   Mehr als 5 Dateien oder mehr als ~80 Zeilen: voller Loop. Wird die Schwelle
   unterwegs gerissen, gilt ab da der volle Loop.
2. Nur Text: Doku, Kommentar, Formatierung, Config — **keine** Logik, kein
   Control-Flow, keine API-/Signaturänderung, keine Migration. Bei Config: bestehende
   Schlüssel mit neuem Wert, oder ein **neuer** Schlüssel, den **kein Anwendungscode liest** —
   eine neue Rolle in `opencode.jsonc` bleibt drin, ein neues Feld in einer vom Anwendungscode
   gelesenen Configdatei nicht. Ausgenommen von der Config-Erlaubnis: alles, was **Berechtigungen, Plugins, `instructions` oder Hooks** berührt — das ist raus, auch wenn kein Anwendungscode es liest. Dafür gibt es den `permissions`-Skill; das läuft durch den vollen Loop.
   Nachweis: `grep -rn '<schlüssel>'` außerhalb der Config-Datei — ein Treffer im Anwendungscode heißt voller Loop. Findet der Orchestrator den Leser nicht, ist das kein Beweis für „liest niemand" — dann delegieren.
   Gelöschte Dateien zählen nur als Kleinigkeit, wenn es Doku- oder reine Textdateien waren — eine gelöschte Datei, die Logik enthielt, ist raus.
3. Keine Dependency-, Lockfile-, Build-, Test- oder Schemaänderung, kein
   Dependency-Manager-Kommando (`pnpm add`, `npm i`, `pip install`, …).
4. Keine inhaltlich neue Regel oder Prozessentscheidung — auch nicht als reiner Text.
   Regel-/Skill-Änderungen laufen durch den vollen Loop, ein Tippfehler darin nicht.
   Ebenso raus: Pflicht, Schwelle oder Ausnahme einer **bestehenden** Regel ändern. K4 meint Verhaltensregeln in `AGENTS.md` und Skills — Tool-Konfiguration nach K2 fällt nicht darunter (dort gelten eigene Grenzen: keine Berechtigungen, Plugins, `instructions` oder Hooks).

**Bleibt unverändert:** pullen (1), Conventional Commit mit expliziten Pfaden und
`git show --stat` (4/5), Push + CI (7). Footer dann als `Verify: entfällt
(Kleinheits-Ausnahme, 0 Runden)` — nicht weglassen, sonst ist später nicht mehr
unterscheidbar, ob ein Lauf stattgefunden hat. **Entfällt:** Implementierer,
Verifikator, `nach-verify`-Runden und der Amend **aus dem Verify-Redo-Pfad** (die
repo-spezifische Amend-Regel unten bleibt unberührt). Der Orchestrator prüft selbst,
mit den Kommandos aus der Repo-`AGENTS.md`, die unter einer Minute laufen (`git diff`
lesen, Lint/Typecheck, Test der betroffenen Stelle). Sonderfall Config ohne Repo (z. B. `~/.config/opencode/opencode.jsonc`): dort gibt es keinen Pull, keinen Commit und keine CI — stattdessen die Datei per `touch` neu laden lassen und in einer frischen Session prüfen. **Kein `AGENTS.todo.md`-Eintrag**
außer bei einer echten Entscheidung — die Pflicht aus den globalen Arbeitsregeln
gilt unverändert, der Kleinkram darunter nicht. **Bei Zweifel: delegieren.** Der Test
ist nicht „ist es leicht“, sondern „ist es eindeutig unter der Schwelle“ — zwei Runden
für einen billigen Task sind billiger als ein Feature mit einem stillen Fehler.

## Ausnahme für dieses Repo

`agents-skills` selbst hat die spezifischere Regel aus `agent-config §6`: Änderungen
werden in den letzten Commit **amended** und mit `--force-with-lease` gepusht, nicht
pro Task einzeln committet. Das schlägt die Regel 4–7 für dieses eine Repo.