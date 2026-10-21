# Skills-Marker

<!--
  Welchen Stand des zentralen Skills-Repos dieses Projekt konsumiert hat.

  Diese Datei wird bei jedem `git pull` im Skills-Repo FORTGESCHRIEBEN, nicht
  abgearbeitet — sie ist ein Cursor, kein Archiv und kein Auftrag (dieselbe
  Unterscheidung wie `AGENTS.todo.md`).
  Format und Ablauf: Skill `skills-marker` im Skills-Repo.
  Die HTML-Kommentare sind Arbeitsanleitung und fallen beim ersten Fortschreiben weg.
-->

agents-skills-consumed: <SHA>
geprüft am: <YYYY-MM-DD>

## Skill-Stand

<!--
  Eine Zeile je Skill aus `.agents/skills/` des Skills-Repos.
  `angewendet?`  = ja | nein
  `wo im Projekt`= `Datei:Zeile` als Beleg (leer bei "nein")
  `offene Position` = Verweis auf den Eintrag in `AGENTS.todo.md` (leer, wenn nichts offen)

  "Angewendet" heißt: am Code dieses Projekts geprüft — nicht: die Doku gelesen.

  | `playwright-parallel` | ja | `playwright.config.ts:41` | |
  | `docker-test-image`   | nein | | trifft CI-Image zu, Repo hat keins |
  Konventionen (Sprache, Größen-Disziplin, eingebettete Regeln) bekommen je eine
  Zeile wie jeder Skill — nie stillschweigend vorausgesetzt (`skills-marker` §4).
-->

| Skill | angewendet? | wo im Projekt | offene Position |
|---|---|---|---|
| | | | |

## Offen aus dem Bereich `<alter-sha>..<neuer-sha>`

<!--
  Nur während eines Prüflaufs. Listet genau die Skills, die in dieser Range neu
  dazugekommen oder geändert wurden — mit dem Ergebnis der Prüfung. Wird beim
  Fortschreiben durch den nächsten Abschnitt ersetzt; bleibt die Liste leer, wird
  dieser Abschnitt ganz entfernt.

  Neu:       git -C <skills-repo> log --diff-filter=A --name-only <alt>..HEAD -- .agents/skills
  Geändert: git -C <skills-repo> log --name-only --format= <alt>..HEAD -- .agents/skills | sort -u
-->

_Kein Vor-Stand: bei einem neu angelegten Projekt gibt es keine Range, weil noch nichts
geprüft werden musste. Dieser Abschnitt wird beim ersten Pull im Skills-Repo angelegt._

## Fortschreiben

<!-- Dieser Abschnitt bleibt stehen — er ist die Anleitung für den nächsten Pull. -->

1. `agents-skills-consumed` ablesen → `<alt>`.
2. Im Skills-Repo die Range bilden:
   `git -C <skills-repo> log --oneline <alt>..HEAD`
   `git -C <skills-repo> log --name-only --format= <alt>..HEAD -- .agents/skills | sort -u`
3. Jeden betroffenen Skill gegen **dieses** Projekt prüfen. Trifft eine Änderung zu, wenn
   sie eine Pflicht, Schwelle, Ausnahme, Konvention oder ein Kommando betrifft, das
   **hier** gilt:
   - trifft zu und ist drin → `angewendet: ja` + `Datei:Zeile`
   - trifft zu, ist nicht drin → offene Position: Eintrag in `AGENTS.todo.md` anlegen
   - trifft nicht zu (das Projekt hat das nicht) → `angewendet: nein` + kurzer Grund
4. Offene Positionen nach `AGENTS.todo.md`; angewendete Zeilen mit `Datei:Zeile` belegen.
   Jede Aussage über einen Stand nennt den Stand, in dem sie gemessen wurde:
   - was der Commit selbst festschreibt (Marker, Board, geänderte Dateien):
     „am committeten Stand dieses Commits" / "at the committed state of this commit";
   - eine Fremddatei, die der Commit nicht anfasst: „gemessen am Vorgänger `<sha>`, seitdem
     unverändert" / "measured at the predecessor `<sha>`, unchanged since" — belegt mit
     `git diff --stat <messstand>..<stand> -- <datei>` (ohne Ausgabe). Beide Enden sind
     Platzhalter: `<stand>` ist der committete Stand dieses Commits, `<messstand>` der Stand,
     an dem gemessen wurde. Gemessen wird mit `git show <messstand>:AGENTS.todo.md | …`,
     `git grep … <messstand> -- …`. `HEAD` ist als Endpunkt falsch — es wandert;
   - eine Datei, die sich seit der Messung geändert hat: „gemessen am Stand `<sha>`" /
     "measured at the state `<sha>`" — der Zählerstand gilt für den genannten Stand, ohne
     Unverändertheitsbehauptung; `git diff --stat <messstand>..<stand> -- <datei>` ist hier
     **nicht** leer — nachmessen, statt die änderung zu leugnen. Das gilt auch für eine Datei,
     die dieser Commit selbst anfasst.
   Der Cursor `agents-skills-consumed` nennt das Skills-Repo — er ist kein Rahmen.
5. Erst wenn für **jeden** Skill aus der Range eine Zeile steht:
   `agents-skills-consumed: $(git -C <skills-repo> rev-parse --short HEAD)`,
   `geprüft am:` auf heute, Abschnitte ersetzen.
6. Falls Regeln oder Skills betroffen waren: die eingebetteten Regeln in der
   globalen `~/.config/opencode/AGENTS.md` gegen ihre Quelle in `.agents/rules/*`
   prüfen und bei geänderter **Pflicht** sinngemäß nachziehen. Drift ist eine
   geänderte Pflicht, kein abweichender Wortlaut — die Einbettung ist die Kurzform
   der Pflicht, kein wörtliches Abbild, und ein Text-Diff gegen die Quelle ist
   **kein** Drift. Dann `touch ~/.config/opencode/opencode.jsonc` (Reload der
   globalen Config; Always-on-Text liefert nur die Einbettung in eine
   `AGENTS.md`).
