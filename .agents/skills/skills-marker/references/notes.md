# Skills-Marker — Begründung, Beispiel, Fallstricke

Ergänzung zu [`../SKILL.md`](../SKILL.md). Dort steht der Ablauf; hier die Begründung
für das Format, eine durchgerechnete Beispiel-Range und die Fälle, an denen der Cursor
sonst still falsch wird.

## Warum ein Cursor und kein Archiv

Ein Archiv im Projekt sammelt die Historie („Skill X wurde am 3.8. ergänzt"). Die eine
Frage, die nach jedem `git pull` gestellt wird, ist aber keine historische: **„habe ich
diesen Stand schon gesehen?"** Ein Archiv beantwortet sie nicht in einer Zeile, man
muss es lesen — und genau das Lesen wird übersprungen, sobald es lang wird.

Der Cursor hält diese eine Antwort: den SHA, bis zu dem geprüft wurde. Alles andere
steht in den Commits, auf die er zeigt, und die Commits liegen ohnehin im Skills-Repo.
Damit ist der Marker klein genug, um in **jedem** Pull-Zyklus tatsächlich
fortgeschrieben zu werden — und eine Datei, die nicht gepflegt wird, ist schlimmer als
keine, weil sie eine Aussage vortäuscht, die niemand mehr prüft.

Zweite Folge, die den Ausschlag gab: nur mit SHA lässt sich die Prüfung **reproduzieren**.
Ein Satz wie „Stand 3.8." im Fließtext nicht.

Der Marker nennt nur den SHA, nie einen Pfad zum Skills-Repo: Repo und Projekt können
auf verschiedenen Maschinen in verschiedenen Verzeichnissen liegen. Wird der Ordner
umbenannt oder verschoben, bleibt der Marker gültig.

## Warum SHA + Datum und keine Version

Der skills-Marker trägt bewusst **keine** Skill-Version, keinen Coverage-Zähler, keinen
„3 von 8"-Stand. Solche Werte sind eine Sorte Information, die still altert: Sie sind
nach dem nächsten Pull falsch, aber nichts zeigt auf sie, also fällt der Fehler erst auf,
wornach jemand falsch handelt. Der SHA dagegen hat eine Eigenschaft, die Versionen fehlen:
Er **beweist** seinen Umfang. Zu einem SHA gehört exakt eine Menge von Commits, und
`git log <sha>..HEAD` liefert sie jederzeit neu.

Das Datum steht aus demselben Grund daneben, aber nur als **Lesehilfe** — für den Fall,
dass der SHA einmal nicht mehr auflösbar ist (siehe unten).

## Durchgerechnetes Beispiel

Marker vor dem Pull:

```md
agents-skills-consumed: a1b2c3d
geprüft am: 2026-08-14
```

Nach `git -C <skills-repo> pull` mit drei neuen Commits:

```sh
$ git -C <skills-repo> log --oneline a1b2c3d..HEAD
9f0e1aa feat(skills): playwright-parallel — locks statt workers=1
4c7d2b1 fix(skills): docker-test-image — GHCR visibility bricht den image pull
71b0e55 docs(skills): agent-config §8 präzisiert

$ git -C <skills-repo> log --name-only --format= a1b2c3d..HEAD -- .agents/skills | sort -u
.agents/skills/agent-config/SKILL.md
.agents/skills/docker-test-image/SKILL.md
.agents/skills/playwright-parallel/SKILL.md
```

Prüfung gegen ein Projekt mit Playwright-Suite, aber ohne CI-Image:

| Skill | angewendet? | wo im Projekt | offene Position |
|---|---|---|---|
| `playwright-parallel` | ja | `playwright.config.ts:41` | |
| `docker-test-image` | nein | | trifft CI-Image zu, Repo hat keins |
| `agent-config` | ja | — | reine Setup-Doku, gilt maschinenweit |

Danach erst wird der Marker auf `9f0e1aa` gesetzt. Die drei Commits tauchen beim
nächsten Pull **nicht** wieder auf — genau das ist der Zweck. Ein Projekt, das keinen
Playwright hat, schreibt in derselben Lage `trifft nicht zu` mit dem Grund
„keine E2E-Suite" und ist fertig.

## Konventionen und eingebettete Regeln als Zeilen

Ändert sich eine Repo-Konvention — Sprache (Englisch für die Skills in diesem Repo),
Größen-Disziplin (`SKILL.md` ~150 Zeilen, Überlauf nach `references/`) oder eine
in eine `AGENTS.md` eingebettete Regel (weil kein Config-Key Regeltext liefert) —
bekommt sie eine Tabellenzeile wie jeder Skill:

| Konvention | angewendet? | wo im Projekt | offene Position |
|---|---|---|---|
| `ask` (eingebettete Frage-Regel) | ja | `~/.config/opencode/AGENTS.md` = Kurzform der Pflicht (Quelle `ask.md`) | |
| Sprache / Größen-Disziplin | nein | | Projekt hat eigene Doku-Konvention |

Regel-Drift diagnostizieren: die eingebettete Regel mit ihrer Quelle in
`.agents/rules/` vergleichen (aktuell die Frage-Regel aus `ask.md`) — Drift ist eine
geänderte **Pflicht**, kein abweichender Wortlaut: die Einbettung ist bewusst
Kurzform, ein Text-Diff gegen die Quelle ist **kein** Drift. Nachziehen heißt
sinngemäß einbetten, nicht die Kurzform wörtlich aufblasen; der Marker hält das erst
als geprüft fest, wenn die Pflicht in der Kopie steht.

## Fallstrick: der Marker-SHA verschwindet

`agent-config` §6 (agents-skills) hatte Amend + `--force-with-lease` als Stil — seit
2026-10-10 sind **separate Commits der Default**, Amend nur für einen noch nicht
gepushten eigenen HEAD. Solange das gilt, bleibt der Marker-SHA stabil.
Verschwindet eine SHA trotzdem (`unknown revision`), war ein Force-Push oder ein
Amend im Spiel — genau dann droht die Kurzschlusshandlung „SHA weg, also jetzt auf
HEAD setzen", womit alles als geprüft gilt, was nie geprüft wurde.

Diagnose und Ausweg:

```sh
git -C <skills-repo> cat-file -e <marker-sha>^{commit} || echo "SHA existiert nicht mehr"

# 1. Kandidat über das Datum suchen
git -C <skills-repo> rev-list --before='<ISO-datum aus geprüft am>' -1 HEAD

# 2. Gegenprobe über die Commit-Meldung, die der Marker noch nennt
git -C <skills-repo> log --format='%h %ad %s' --date=short -20
```

Der gefundene Commit ist der Marker-Stand **vor dem Amend**. Von ihm aus die Range neu
bilden — sie ist dadurch kleiner als erwartet, die Arbeit ist begrenzt. **Nicht** auf
HEAD springen: das wäre die eine Kurzschlusshandlung, die den Cursor wertlos macht, weil
sie genau die Aussage erzeugt, die er verhindern soll.

## Fallstrick: die Range vor dem Pull bilden

Ein lokaler Klon, der noch nicht gepullt hat, hat ein HEAD, das dem Remote um Commits
hinterherhinkt. Wer die Range vor dem Pull bildet, prüft eine Range, die es so gar nicht
gibt, und schreibt danach einen SHA in den Marker, den das Remote nie gesehen hat. Der
Ablauf ist deshalb ausdrücklich: **pullen, dann Range bilden** — und wenn beide
gleichzeitig passieren sollen, dann im selben Schritt, nicht in zwei verschiedenen
Sessions.

## Fallstrick: ein Skill verschwindet

Wird ein Skill im Skills-Repo gelöscht, steht seine Zeile im Marker plötzlich für einen
Pfad, den es nicht mehr gibt. Die Zeile **nicht** stillschweigend entfernen: im
Bereichs-Abschnitt des nächsten Pulls „`docker-test-image` — entfernt in `<sha>`"
notieren, dann verschwindet sie beim nächsten Fortschreiben mit. Sonst bleibt die Frage
offen, ob das Projekt den Inhalt inzwischen selbst braucht.

## Gemessen: Anker verrotten (`portal.reisinger.pictures` × `agents-skills`)

Erster vollständiger Anker-Audit: Nach dem Fortschreiben des Markers in
`portal.reisinger.pictures` auf einen neuen `agents-skills`-SHA wurden alle
Belege geprüft — 13 `Datei:Zeile`-Referenzen plus eine Behauptung ganz ohne
Zeile. **Fünf der dreizehn Anker waren falsch (38 %)** — alle aus demselben
Grund: Die Zieldatei war gewachsen (`AGENTS.md` hatte Abschnitte gewonnen, ein
Workflow Zeilen), die protokollierten Zeilennummern nicht; die fünf zeigten
still auf fremden Inhalt. Eine Zeile war schlimmer als veraltet: Eine
„trifft nicht zu, weil keine Path-Filter"-Begründung war falsch geworden, weil
ein späterer Commit sie hinzugefügt hatte. Eine Zahl ohne Herkunft ist genau das,
was dieses Repo sonst entfernt — darum steht sie hier mit beiden Repos.

## Der Bezugsrahmen einer Aussage über einen Stand

Jede Aussage im Marker, die einen Stand nennt, nennt **den Stand, in dem sie
gemessen wurde**. Das ist die Pflicht aus der gemeinsamen Regel
(`.agents/rules/build-verify.md`, Regel 5): „Every number in the message that
claims something about the commit or its gates names what it measures — the state
it was measured in (working tree, committed state) and the scope it covers …" Eine
Aussage ohne Rahmen ist unprüfbar: der nächste Pull liest sie und findet einen
anderen Baum.

### Der Selbstbezug — warum „dieses Commits" und nicht eine SHA

Der Marker-Commit **schreibt** die Datei, die den Rahmen nennt. Seine eigene SHA
existiert beim Schreiben noch nicht, sie entsteht erst mit dem Commit. Er kann
sich also nicht selbst benennen — jede SHA im Rahmen ist damit **immer ein
Vorgänger** des schreibenden Commits.

Das ist kein Schönheitsfehler, sondern ein falscher Bezug: der Vorgänger ist ein
anderer Baum als der, den der Commit festschreibt. Der Rahmen „am committeten
Stand `e744f8b`" beschreibt damit einen Zustand, den die Datei **nicht**
festschreibt. Drei Formen, je nachdem, was gemessen wurde:

| Die Aussage beschreibt | Der Rahmen lautet | Warum |
|---|---|---|
| den Marker selbst, das Board, jede Datei, die dieser Commit ändert | **am committeten Stand dieses Commits** / „at the committed state of this commit" | der schreibende Commit nennt den Stand, den er selbst festschreibt |
| eine Fremddatei, die dieser Commit **nicht** anfasst | **gemessen am Vorgänger `<sha>`, seitdem unverändert** / „measured at the predecessor `<sha>`, unchanged since" | der genannte SHA ist der **Messstand** (nicht zwingend der direkte Vorgänger) — die Unverändertheit wird belegt |
| eine Fremddatei, die sich **seit der Messung geändert** hat | „gemessen am Stand `<sha>`" / „measured at the state `<sha>`" — der Stand, an dem sie gemessen wurde, **mit dessen SHA** (kein „seitdem unverändert") | der Zählerstand gilt für den genannten Stand; die Datei ist seither anders — der Diff-Beleg ist **nicht** leer |

Der Beleg für die zweite Form ist `git diff --stat <messstand>..<stand> -- <datei>`
— **ohne Ausgabe** heißt: die Datei ist zwischen Messstand und Stand
unverändert, also gilt die am Messstand gemessene Zählung heute noch. Beide
Enden sind **Platzhalter**: der Marker kennt seine eigene SHA nicht (sie entsteht erst
mit dem Commit) und nennt deshalb `<stand>` für den Stand, über den die Aussage gemacht
wird, und `<messstand>` für den Stand, an dem gemessen wurde. `HEAD` ist als Endpunkt
falsch — es wandert, und dieselbe Formel beweist zur Lesezeit etwas anderes. Der
Platzhalter gilt für **jeden** gemessenen Stand, im eigenen Repo wie in einem anderen:
gemessen wird mit `git show <messstand>:AGENTS.todo.md | …`,
`git grep … <messstand> -- …` — der gemessene Stand, nicht der Stand, über den die
Aussage gemacht wird; bei Form (a) sind beide derselbe Stand. So trägt der Rahmen den
Wert, und der Leser setzt ihn ein. Form (b) trägt die Zählung **und** den
Messstand, damit der Leser prüfen kann, statt zu glauben.

Ein SHA im Rahmen, der weder der Stand des schreibenden Commits noch der benannte
Messstand ist, ist ein Fehler. Die dritte Zeile der Tabelle ist kein Notfall, sondern
der Fall einer Datei, die sich zwischen der Messung und dem Commit geändert hat: der
Zählerstand gilt für den genannten Stand — nachmessen, statt die änderung zu leugnen.

Ein **Zähler** bleibt verboten (§2: „SHA + Datum, sonst nichts" — kein
`offen: 5`, kein „80 % angewendet"). Eine **Messung mit Rahmen** ist etwas
anderes: sie steht in der Zelle einer Zeile, nennt ihren Stand und wird beim
nächsten Pull nachgemessen statt still zu altern. Der Unterschied ist der
Rahmen, nicht die Zahl.

### Der Cursor bleibt, was er ist

`agents-skills-consumed:` nennt den Stand des **Skills-Repos**, nicht des
Projekts — und dieser SHA existiert **vor** dem Commit. Er ist kein Rahmen und
wird nicht umgestellt: die Regel gilt für Aussagen **über** den Projektstand,
nicht für den Cursor, der auf einen anderen Repo-Stand zeigt.

### Gemessen: `LuminaRust` `0cf154d` — 10 Vorgänger-Rahmen

Der Marker-Commit `0cf154d` (Marker-Datei-Stand `AGENTS.skills.md` am
committeten Stand `0cf154d`) nennt in seinem Vorgänger `e744f8b`
(`git rev-parse --short 0cf154d^` → `e744f8b`) **10-mal** als Rahmen die
Formel „committeter Stand `e744f8b`" — Zählweise: alle Treffer des Textes
„committeter Stand `e744f8b`" mit normalisiertem Zeilenumbruch
(`re.sub(r'\s+',' ',text)`), also 9 zeilenweise Treffer (auf 8 Zeilen, Zeile 18
trägt die Formel zweimal) plus 1 über den Zeilenumbruch zwischen Zeile 133 und
134 hinweg. **Ein zeilenweises Zählen kommt darunter:** `grep -o … | wc -l`
zählt **9**, `grep -c` zählt **8** Zeilen. Verteilung: Zeilen 12, 14, 15, 16, 17,
18 (zweimal), 19, 30 und 133/134. Die Datei nennt `e744f8b` insgesamt **14-mal**:
die 10 Rahmen, 1 Range-Anker („ab `e744f8b`", der Startpunkt des
40-Commit-Fensters — kein Rahmen) und 3 Kommando-Argumente
(`git rev-list --max-count=40 e744f8b`, zweimal
`git grep -n ui-review e744f8b`). Das Board `Agents.todo.md` desselben Commits
nennt ebenfalls einen Vorgänger (`fa6411c`), dort in der Form „gemessen am
committeten Stand `fa6411c`".

Die Verifikation in `LuminaRust` (`51c430a`) hat die **11 Rahmenstellen** einzeln
geprüft — und sie zählt **Stellen in zwei Dateien**: 10 in `AGENTS.skills.md`, 1 im
Board `Agents.todo.md`. Von diesen 10 Marker-Stellen tragen **9** die Formel
(„committeter Stand `e744f8b`", Zeile 18 zweimal → 10 Treffer); die 10. ist der
**Range-Anker** „ab `e744f8b`" im 40-Commit-Fenster der `build-verify`-Zeile — ein
Bereichsanfang, kein Rahmen, der Anker bleibt dort stehen. Umgestellt wurde auf
6 × Form (a) und 5 × Form (b); Form (b) trägt den belegten Nachweis, Form (a)
nicht — dort ist der Stand der des Commits selbst.

Die Zahl 11 der Verifikation und die 10 Rahmen im Marker sind also
**verschiedene Zählungen**: die Verifikation zählt *Stellen in zwei Dateien*, die
10 zählen *Treffer einer Formel in einer Datei*.

### Gemessen: `opencode-pwa` `45cb323` — ein Vorgänger-Rahmen

Derselbe Fehler, an einer Stelle: der Marker-Commit `45cb323` nennt den
Vorgänger `c737d17` (`git rev-parse --short 45cb323^` → `c737d17`) als Rahmen der
Anker-Aussage — „alle Zeilen der Tabelle am committeten Stand (`c737d17`) neu
belegt" (1 Treffer der Formel „committeten Stand (`c737d17`)" im Marker-Stand
`AGENTS.skills.md` am committeten Stand `45cb323`; die Datei nennt `c737d17`
insgesamt 2-mal, die zweite Nennung ist ein Kommando-Argument). Drei weitere
Rahmen desselben Markers nannten gar keinen SHA. Behoben in `c86138b` und
`ddd15a4` mit Form (a) und Form (b).

Form (b) nennt den **Messstand** — den Stand, in dem die Datei gemessen wurde, nicht
zwingend den direkten Vorgänger des schreibenden Commits. Der Beleg
`git diff --stat <messstand>..<stand> -- <datei>` muss **ohne Ausgabe** sein: die Datei ist
zwischen dem genannten Stand und dem Commit unverändert, also gilt die am Messstand
gemessene Zählung heute noch. Der Endpunkt ist der **benannte Commit**, dessen Aussage
belegt wird, nicht `HEAD` — `HEAD` wandert, und dieselbe Formel beweist zur Lesezeit etwas
anderes. Die Form steht im Marker-Stand von `opencode-pwa` (`473de80`) als
`git diff --stat <sha>..<stand> -- <pfad>`: `<stand>` ist der committete Stand des
schreibenden Commits, und weil der Marker seine eigene SHA nicht kennt, bleibt der
Endpunkt ein Platzhalter, den der Leser einsetzt.

Ein Label wird deshalb **bei jedem Commit neu gesetzt**: es nennt den Stand, an dem
tatsächlich gemessen wurde, und es wird gegen den Commit belegt, der die Aussage
trägt. Ein mitgeschlepptes Label zeigt auf einen **älteren** Stand und trägt den
Diff-Beleg nicht: `ddd15a4` nennt `45cb323`, obwohl `git rev-parse --short
ddd15a4^` → `c86138b` ist, und `AGENTS.todo.md` hat sich zwischen `c86138b` und
`ddd15a4` geändert (`git diff --stat c86138b..ddd15a4 -- AGENTS.todo.md` → 15
Einfügungen, 11 Löschungen). Die Zählung bleibt dabei gleich (7 offene Kästchen in
`45cb323`, `c86138b` und `ddd15a4`), das „seitdem unverändert“ gilt für die Datei aber
nicht mehr — es ist der Zähler, der gleich bleibt, nicht der Baum. Wer ein Label
übernimmt, setzt es am neuen Commit neu und belegt es neu.

## Wo steht was

| Aussage | Datei |
|---|---|
| Welchen Stand dieses Projekt konsumiert hat | `<projekt>/AGENTS.skills.md` |
| Was **dieses Projekt** gelten muss (Kommandos, Schwellen, Gates) | `<projekt>/AGENTS.md` |
| Was als offene Position noch umzusetzen ist (Log, kein Auftrag) | `<projekt>/AGENTS.todo.md` |
| Wie dieses Format aussieht und wie man es fortschreibt | `<skills-repo>/.agents/skills/skills-marker/SKILL.md` |

Die vier Aussagen überschneiden sich nicht. Der Verwechslungsfehler, den der Marker
verhindern soll, ist genau dieser: eine **globale** Skill-Regel als **projektlokale**
Pflicht zu behandeln (⇒ offene Position, die keiner braucht) oder eine echte
Projektpflicht zu übergehen, weil „die Skill sagt das ja sowieso" (⇒ stille Lücke).

## Ein Marker je Repo

Genau eine `AGENTS.skills.md` im Repo-Root. Monorepos mit mehreren Packages führen
**keine** zweite: sie referenzieren die Root-Datei. Zwei Marker bedeuten zwei Cursoren,
die auseinanderlaufen, und die Frage „welcher gilt?" ist teurer als die Arbeit, die sie
einsparen — zumal beide Dateien von Hand aktualisiert werden müssten und der
zuverlässigere davon still veraltet.
