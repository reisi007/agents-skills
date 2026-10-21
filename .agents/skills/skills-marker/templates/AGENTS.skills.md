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
   Bezugsrahmen — die gemeinsame Regel, **zitiert statt kopiert**: `skills-marker/SKILL.md` →
   „Bezugsrahmen-Regel" (Skill-ID + Datei + Anker, **ohne Zeilennummer** — die driftet, der
   Anker bleibt); Wortlaut, Belege und Fälle: `skills-marker/references/notes.md`
   § „Der Bezugsrahmen". Diese Liste nennt die **Fälle**, nicht die Fassung — steht eine Form
   nicht an der Zitierstelle, ist sie hier falsch:
   - (a) was der Commit selbst festschreibt (Marker, Board, geänderte Dateien) / what the
     commit fixes itself;
   - (b) eine Fremddatei, die der Commit nicht anfasst und die seit dem genannten Stand
     **unverändert** ist / a foreign file, unchanged since the named state;
   - (c) eine Datei, die sich seit dem genannten Stand **geändert** hat / a file that changed
     since the named state.
   Der genannte SHA ist der **Messstand** — ein **Vorfahr**, nicht zwingend der direkte
   Vorgänger; (b) und (c) unterscheiden sich an der **Zeitform** (unverändert seit / geändert
   seit) — das **Nomen** („Vorgänger" / „Stand") entscheidet den Fall **nicht**.
   Fünf Regeln trägt die Zitierstelle — hier als **Kurzform zur Erinnerung; die Fassung steht
   dort, und weicht sie ab, gilt die Zitierstelle**:
   - eine Messung, deren Umfang der Commit selbst schreibt, trägt **keinen** Vorgänger-Rahmen
     — die Zeile mit dem Suchkommando zählt mit: nur der Wert am committeten Stand, oder alle
     Werte, jeder mit seinem Stand (auch bei mehr als zwei Ständen), oder über den Vorgänger
     nur der Vergleich dessen, was **gleich** bleibt (z. B. die Dateimenge);
   - eine Aussage über **wann** etwas galt, nennt den Stand, zu dem es galt (SHA **und**
     Messzeitpunkt — der Zeitpunkt der Messung, nicht der des genannten Stands); ist der
     Bezugszeitpunkt nicht belegbar, nennt sie den gemessenen Stand mit Zeitpunkt;
   - ein Marker **zitiert** die Regel statt sie zu kopieren (Pfad im Skill + Anker, ohne
     Zeilennummer); eine eigene Zusatzregel des Projekts ist erlaubt, wenn sie als **lokale
     Ergänzung** gekennzeichnet ist und die gemeinsame Regel nicht ersetzt:
     **Lokale Ergänzung:** <was in diesem Projekt zusätzlich gilt>
   - eine **Aufzählung** trägt zwei Behauptungen: jedes Element trägt die Eigenschaft, und die
     Liste ist die ganze Menge — beides ist zu belegen; eine handgepflegte Aufzählung wird
     durch ein Kommando ersetzt, das die Menge ableitet;
   - ein Verweis trägt nur, wenn der **Cursor** den Stand deckt, in dem die Zitierstelle
     existiert: wer zitiert, rückt den Cursor vor (bis der Anker existiert) und begeht die
     Range dazwischen. Der Cursor bleibt, was er ist: er nennt den **konsumierten** Stand.
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
