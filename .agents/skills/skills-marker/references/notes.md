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

## Warum die Auswahlregel meist in einem Satz entschieden ist

(Kurzform: `SKILL.md` §4.) Die Auswahlregel („trifft zu" / „trifft nicht zu") ist selten mehr
als ein Satz: eine gute Änderung **liefert ihren Geltungsbereich mit** — steht dort „in jedem Projekt"
oder „in CI-Workflows mit …", ist die Antwort sofort klar. Bleibt der Geltungsbereich offen,
gewinnt im Zweifel **ja** mit offener Position, nicht **nein**.

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

## Fallstrick: der Marker fehlt

Fehlt `AGENTS.skills.md`, ist das Projekt **nicht gescaffoldet** — `codegraph-project-setup`,
Schritt 2.5. Der Marker ist die Datei, in der das Ergebnis der Prüfung steht; ohne sie hat der
nächste Pull nichts, was er fortschreiben könnte.

## Fallstrick: der `Verify:`-Footer

Ein Footer, der **Runden** nennt, braucht ein Schema, das sich **nicht überschneidet** — oder
er nennt die Runden **ohne IDs**. Zwei Runden, die dieselbe ID verwenden, machen den Footer
unlesbar: der Leser weiß nicht, welcher Befund geschlossen ist und welcher offen. Die ID
gehört deshalb zur Runde („R1-F1", „R2-N1") — oder der Footer nennt je Runde nur die Zahl der
Befunde („Runde 1: 3 medium, 6 low, 3 informational"), und die Herkunft steht im Body.

Der Footer von `65fbecc` verletzt beides: Runde 3 steht mit **N-1 bis N-8** (acht IDs) neben
**fünf** Befunden (2 low + 3 informational), und die **F**-IDs kollidieren mit denen der
Runde 1 im selben Footer. Der **Inhalt** ist aus den Dateien belegbar, die **Kennzeichnung**
nicht — dieselbe Fehlerform, die diese Serie in den Markern bekämpft: eine Zahl ohne ihren
Bezugsrahmen.

(Ihren natürlichen Ort hat die Regel in `.agents/rules/build-verify.md`, Regel 5 — dem
`Verify:`-Footer. Der Auftrag dieser Runde erlaubte nur die drei Dateien dieses Skills,
deshalb steht sie hier; sie gehört beim nächsten Anlass dorthin.)

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

## Der Bezugsrahmen

Jede Aussage im Marker, die einen Stand nennt, nennt **den Stand, in dem sie
gemessen wurde**. Das ist die Pflicht aus der gemeinsamen Regel
(`.agents/rules/build-verify.md`, Regel 5 am Stand `80664ab`): „**Every number in the
message that claims something about the commit or its gates names what it measures** —
the state it was measured in (working tree, committed state) and the scope it covers …"
Eine Aussage ohne Rahmen ist unprüfbar: der nächste Pull liest sie und findet einen
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
| **(a)** den Marker selbst, das Board, jede Datei, die dieser Commit ändert | **am committeten Stand dieses Commits** / „at the committed state of this commit" | der schreibende Commit nennt den Stand, den er selbst festschreibt |
| **(b)** eine Fremddatei, die dieser Commit **nicht** anfasst | **gemessen am Vorgänger `<sha>`, seitdem unverändert** / „measured at the predecessor `<sha>`, unchanged since" | der genannte SHA ist der **Messstand** (nicht zwingend der direkte Vorgänger) — die Unverändertheit wird belegt |
| **(c)** eine Datei, die sich **seit der Messung geändert** hat | „gemessen am Stand `<sha>`" / „measured at the state `<sha>`" — der Stand, an dem sie gemessen wurde, **mit dessen SHA** (kein „seitdem unverändert") | der Zählerstand gilt für den genannten Stand; die Datei ist seither anders — `git diff --stat <messstand>..<stand> -- <datei>` ist **nicht** leer |

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
der Fall **einer Datei**, die sich zwischen der Messung und dem Commit geändert hat — auch
eine, die dieser Commit selbst anfasst: der Zählerstand gilt für den genannten Stand,
nachmessen, statt die änderung zu leugnen.

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

**Die Ergänzung, die gleichzeitig gilt:** Der Cursor deckt den **konsumierten** Stand ab.
Wer in einem Marker Regelinhalt **zitiert**, der erst **nach** diesem Stand entstanden ist,
rückt den Cursor vor, damit er den zitierten Inhalt deckt, und begeht die Range dazwischen.
Beides gilt nebeneinander: der Cursor bleibt, was er ist — er nennt den **konsumierten**
Stand; er wird **nicht** zum Rahmen einer Aussage, und er wird **nicht** zum Archiv.

### Die Formen (b) und (c) unterscheiden sich an der Zeitform

**Regel:** (b) und (c) nennen beide einen **Vorfahren**; das **Nomen** („Vorgänger" /
„Stand") **entscheidet den Fall nicht** — die beiden Formen unterscheiden sich an der
**Zeitform** (unverändert seit dem genannten Stand (b) oder geändert seit ihm (c)). Der
genannte SHA ist der **Messstand**: ein Vorfahr, nicht zwingend der direkte Vorgänger. Die
bestehende Wortlaut-Fassung bleibt: „gemessen am Vorgänger `<sha>`, seitdem unverändert" (b)
und „gemessen am Stand `<sha>`" (c) — geklärt wird, **was** die Formen unterscheidet, nicht
sie umbenannt.

Beleg — gemessen in `LuminaRust` und `opencode-pwa` (read-only), Marker-Stände `207b6e4` und
`a3e4a9f`:

- `LuminaRust` `207b6e4`: `AGENTS.skills.md` nennt `e744f8b` auf **9** Zeilen (**12**
  Occurrences); **8** dieser 9 Zeilen paaren ihn mit dem Wort „Vorgänger", **2** Zeilen tragen
  die Formulierung „am **Vorgänger** `e744f8b`" (geschrieben von `d38f4fa`, dessen direkter
  Vorgänger `51c430a` ist — `e744f8b` liegt **3** Commits davor, `git rev-list --count
  e744f8b..d38f4fa` → **3**). Nach dem **früheren** Wortlaut der `SKILL.md` am Stand
  `65fbecc` (`65fbecc:.agents/skills/skills-marker/SKILL.md:60`: „eine SHA im Rahmen ist
  also immer ein **Vorgänger** […]" — dieselbe Formel steht am Stand `37cefe2`
  (`37cefe2:.agents/skills/skills-marker/SKILL.md:53`) als „**Vorfahr**") liest sich das als
  Fehler, nach der Semantik dieser Datei (der genannte SHA ist der **Messstand**) ist es
  korrekt — dieselbe Regel, zwei Verdikte, je nachdem, welche Datei man liest.
- `opencode-pwa` `a3e4a9f`: `AGENTS.skills.md` nennt „Vorgänger" **7-mal**,
  `AGENTS.todo.md` **8-mal**; „gemessen am Stand" kommt in **keiner** der beiden Dateien vor
  (**0**). Die Projekte benutzen also durchgehend die Wortlaut-Fassung der Form (b) — eine
  Umbenennung hätte ihre Marker entwertet.

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

### Die Messung, die den Commit selbst mitzählt

**Regel:** Wenn der **Umfang** einer Messung eine Datei einschließt, die der Commit
selbst schreibt, **misst die Messung den Commit mit** — die neue Zeile mit dem
Suchkommando wird mitgezählt. Eine solche Messung trägt **keinen** Vorgänger-Rahmen. Drei
Wege bleiben: nur der Wert am committeten Stand; **alle** Werte, jeder mit seinem Stand
(„am Vorgänger `<sha>`: …; am committeten Stand dieses Commits: …" — bei mehr als zwei
Ständen einer je); oder über den Vorgänger nur der Vergleich dessen, was **gleich** ist
(etwa die Dateimenge). Der dritte Weg ist der Kern der Klausel, nicht eine Nebenbemerkung —
er ist die Form, die im `LuminaRust`-Marker lokal erprobt wurde.

Zwei Dinge sind zu trennen: der **Rahmen** ist in jedem Fall betroffen, weil der Commit die
Datei verändert (also „seitdem unverändert" nicht gilt); die **Zählung** ändert sich nur,
wenn die vom Commit geschriebene Datei das Suchmuster auch enthält.

Das schließt die Form (c) der Rahmen-Tabelle nicht aus: sie bleibt erlaubt, wenn die
**gemessene** Datei eine ist, die der Commit selbst anfasst. Verboten ist der Vorgänger-Rahmen über eine
Messung, deren **Umfang** solche Dateien einschließt — dort zählt die Zeile des Commits
mit, und der Zählerstand gilt für den Stand, an dem gemessen wurde.

Beleg — gemessen in den Verifikationsrunden der drei Projekte, nicht in diesem Repo. **Die
Konvention der drei Bullets:** jede nennt den Stand, an dem der **Fehler** stand, und danach
den Commit, der ihn behob — nicht den korrigierten Stand. (Ein Bullet, der den korrigierten
Stand nennt, führt beim Nachlesen zur falschen Zeile: die Fehlerform steht einen Commit
davor.)

- `open-accreditation`: der **Fehlerstand** ist der Marker-Stand `2da0404:AGENTS.skills.md:43`
  — dort trug der Marker die **repo-weite** Grep-Zahl („**49** Zeilen-Treffer in **22** Dateien […]")
  unter dem Rahmen „Gemessen am Vorgänger `a4551c8` (seitdem unverändert) […]". Der Commit
  `2da0404` schrieb `AGENTS.todo.md` **und** `AGENTS.skills.md` — und **diese Dateien
  enthalten das Suchmuster selbst**. Dieselbe Messung (`git grep -in baseline <stand> -- .`)
  ergab am Stand `a4551c8` **49** Zeilen in **22** Dateien und am Stand `2da0404` **54**
  Zeilen in **22** Dateien. Die Treffer nach Muster: `items-baseline` **12**, `$baseline`
  **11**, `baseline-browser-mapping` **5** — **2** Zeilen tragen zwei Muster (die beiden vom
  Commit selbst geschriebenen Zeilen `AGENTS.skills.md:43` und `AGENTS.todo.md:1307`), also
  **25** der **54** Zeilen und **29** Rest (priorisiert: **12/9/4/29**); am Stand `a4551c8`
  dagegen **10/9/3/27** auf **22** der **49** Zeilen, ohne Mehrfachtreffer. Die beiden Stände
  mischen also verschiedene Zähleinheiten — vergleichbar sind die **Zeilenzahlen**, nicht die
  Occurrences. Die Board-Messung unter
  demselben Rahmen (`git grep -inE '\bowner\b|\bticket\b' <stand> -- AGENTS.todo.md`) ergab
  am Stand `a4551c8` **4** und am Stand `2da0404` **15**. Der Rahmen war doppelt falsch: die
  Datei war verändert (also kein „seitdem unverändert"), und der Wert galt für den Vorgänger,
  nicht für den Stand, den der Commit festschreibt. **Behoben in `c353313`** (Befund N1,
  medium) — dort steht bereits die richtige Form („sind es **54** Zeilen-Treffer in **22**
  Dateien am committeten Stand dieses Commits — dieser Wert kann **keinen** Vorgänger-Rahmen
  tragen, weil die Doku Teil […]").
- `opencode-pwa`: der **Fehlerstand** ist der Marker-Stand `c86138b:AGENTS.skills.md:177`
  — eine gleichlautende Aussage steht in `45cb323:AGENTS.skills.md:167` (dort „die einzigen
  Fundstellen nach diesem Fortschreiben […]"), die Zeile 177 desselben Stands trägt einen
  anderen Satz. Am Fehlerstand lautet der Wortlaut „die einzigen Fundstellen seither […]".
  Gemessen mit
  dem Suchmuster `W3` an diesem Stand: im Marker **3** Zeilen (`grep -c` zählt **Zeilen**;
  `grep -o … | wc -l` zählt **4** Occurrences), im Board **2** Zeilen, am Vorgänger `c737d17`
  **0** — an **keinem** Stand der Serie (`c737d17`, `45cb323`, `c86138b`, `ddd15a4`) war „nur
  eine" wahr. Der Fehltreffer war exakt die Zeile mit dem Suchkommando, die der Commit
  selbst geschrieben hat. **Behoben in `ddd15a4`** (Befund **N1, low** — der Commit-Body
  nennt „N1 - the W3 reference named the wrong advance") — dort steht die berichtigte
  Zählung.
- `LuminaRust`: der **Fehlerstand** ist der Marker-Stand `51c430a:AGENTS.skills.md:135-137`
  (Zeile 135 „dieselbe Zählung im **Vorgänger**", Zeile 136 `e744f8b`; der Fix-Commit nennt
  selbst `AGENTS.skills.md:134`) — dort stand „dieselbe Zählung im **Vorgänger** `e744f8b`". `git grep -n ui-review <stand>
  -- '*.md'` ergab am Stand `e744f8b` **5** Zeilen in **2** Dateien, am direkten Vorgänger
  `0cf154d` (= `51c430a^`) **6** in **2**, am Stand `51c430a` **6** in **2** — die Zählung ist
  am Vorgänger **nicht** dieselbe, die Dateimenge schon. **Behoben in `d38f4fa`** (Befund B1,
  low) — dort steht „am **Vorgänger** `e744f8b` ist die **Dateimenge** dieselbe […]". Der
  Verifier
  hielt dort ausdrücklich fest, dass diese Klausel **kein** Upstream-Gegenstück hat, weil
  upstream sie noch nicht trug — sie trägt sie jetzt.

### Die Aussage über einen Zeitpunkt

**Regel:** Eine Aussage darüber, **wann** etwas galt, nennt den Stand, **zu dem** sie gilt
(SHA **und** Messzeitpunkt — der **Zeitpunkt der Messung**, nicht der Zeitstempel des
genannten Stands), nicht eine relative Angabe („beim Commit dieses Markers", „heute",
„seither") über einen Zustand, der sich bewegt. Ein `HEAD` ist per Definition
beweglich; der **belegte** Stand nicht. Ist der Bezugszeitpunkt nicht belegbar — weil der
Zustand inzwischen weitergegangen ist —, trägt die Aussage den **gemessenen** Stand mit
Zeitpunkt.

Beleg: `open-accreditation` `c353313:AGENTS.skills.md:9` (medium): die Kopfnote behauptete,
der HEAD des Skills-Repos habe „beim Commit dieses Markers auf `0449b05` […]" gestanden.
Gemessen über die Reflog-Zeitachse des Skills-Repos stand er da bereits auf `7910ec6` — der
Pull lag **31 Minuten** vor dem Commit (Commit-Zeit `c353313`: **2026-10-21 10:12:18 +0000**,
in der Verifikationsrunde des Projekts gemessen). Die Aussage war **falsch** und widersprach dem
unmittelbar folgenden **Satz derselben Satzgruppe** (nachgemessen in jener Verifikationsrunde:
der Blockzitat-Absatz `c353313:AGENTS.skills.md:6-30` — die erste Leerzeile steht erst in
Zeile 31 — trägt mehr als vier Sätze; **vier** Sätze hat seine erste Satzgruppe `:6-14`, und
der Widerspruch liegt zwischen **Satz 2 und Satz 3** dieser Gruppe).

**Selbst gemessen in diesem Repo** (das Skills-Repo selbst), `git reflog --date=iso`:

```
7910ec6 HEAD@{2026-10-21 09:41:13 +0000}: pull --rebase: Fast-forward
0449b05 HEAD@{2026-10-21 07:43:59 +0000}: commit: docs(build-verify): every number in the footer names what it measures
```

Der HEAD des Skills-Repos stand damit von **07:43:59** bis **09:41:13** auf `0449b05` und
von **09:41:13** bis **12:37:35** auf `7910ec6` — das Fenster ist durch den nächsten
Reflog-Eintrag (`e523df9`, **2026-10-21 12:37:35 +0000**) abgeschlossen, nicht offen. Der
Marker-Commit `c353313` liegt in diesem Fenster und nennt einen überholten Stand.

### Wie ein Projektmarker die Regel zitiert

**Regel:** Ein Projektmarker, der die Regel anwendet, **referenziert** sie (Pfad **im
Skill** + Anker, **ohne** Zeilennummer — die driftet) statt sie zu **kopieren**. Eine
**eigene Ergänzung** des Projekts (etwa eine projektspezifische Zusatzregel) ist erlaubt,
wenn sie als **lokale Ergänzung** gekennzeichnet ist und die gemeinsame Regel nicht
ersetzt.

Die Zitierstelle ist die Zeichenkette `Bezugsrahmen-Regel` in `skills-marker/SKILL.md`:
`skills-marker/SKILL.md` → „Bezugsrahmen-Regel". Sie ist ein **Anker**, keine Zeilennummer
— Zeilen und Überschriften dürfen sich ändern, die Zeichenkette bleibt; wer sie entfernt,
bricht die Zitierstellen der Projekte. Der Pfad nennt **Skill-ID + Datei**, nicht einen Pfad
zum lokalen Clone: der Marker nennt keinen Pfad zum Skills-Repo (§1 des `SKILL.md`), und
eine Maschine ohne Clone des Skills-Repos hat trotzdem den Anker.

Ein Marker darf die Regel deshalb nicht als eigenen Wortlaut führen. Die Vorlage trägt
deshalb den **Verweis** und die **Fälle**; die fünf Regeln stehen dort als **Kurzform zur
Erinnerung**, mit dem Vorrang der Zitierstelle: weicht die Kurzform ab, gilt die
Zitierstelle. Die drei Formen stehen an der Zitierstelle, und ein Projekt, das dorthin geht,
trifft den dritten Fall nicht mehr blind. Die Vorlage nennt zusätzlich die Markierung einer
eigenen Ergänzung (`**Lokale Ergänzung:** …`): daran sieht der Leser, dass dort eine
Projektregel steht und nicht die gemeinsame.

Beleg:

- `LuminaRust` `9a4bcd9`: der Marker führt die Regel als **lokale Kopie** im Abschnitt
  „Fortschreiben" plus einen Herkunftsvermerk („sie steht **nur hier** — der committete
  Stand des Skills-Repos (`7910ec6`) führt sie nicht […]"). Mit `e523df9` trägt das geteilte Instrument die Regel;
  die **Bedingung** des Vermerks („kommt sie dort auf, wird sie hier durch einen **Verweis**
  ersetzt […]") ist damit eingetreten — der Verifier nennt die Ablösung **fällig**: *Verweis auf
  die Upstream-Regel **+ Beibehaltung** des lokalen Zusatzes*. Nachgemessen in jener Runde:
  ohne Upstream-Gegenstück ist der **erste** Satz der Kopie
  (`9a4bcd9:AGENTS.skills.md:206-209`) — der zweite, der Vergleich über den Vorgänger, ist
  durch die neue Klausel abgedeckt.
  **Selbst gemessen in diesem Repo:** der Regelsatz „**Jede Aussage über einen Stand nennt
  den Stand, in dem sie gemessen wurde**" steht in `git show
  7910ec6:.agents/skills/skills-marker/SKILL.md` **0-mal**, in `git show e523df9:...`
  **1-mal** — die Bedingung des Vermerks ist erfüllt. Der **Anker** `Bezugsrahmen-Regel`
  steht an **beiden** Ständen **0-mal**; er kam mit `65fbecc` dazu (siehe den Abschnitt „Ein
  Verweis trägt nur, wenn der Cursor den Stand deckt, in dem die Zitierstelle existiert" weiter
  unten).
- `opencode-pwa` `473de80`: der Marker trägt einen **neuen Kopf** „Messkonvention" mit
  `<stand>`-Definition und einer Kurzfassung der Formen (a)/(b) — wieder eine Kopie. Der
  Verifier: die Kopie bricht **keine** vorhandene Konvention, verliert aber das Etikett, an
  dem das Geschwisterprojekt die Kopierbarkeit erkennt.

### Ein Verweis trägt nur, wenn der Cursor den Stand deckt, in dem die Zitierstelle existiert

**Regel:** Ein Marker, der die Regel **zitiert**, muss seinen Cursor auf einen Stand
**vor**rücken, in dem die Zitierstelle **existiert**, und die **Range** zwischen altem und
neuem Cursor **begehen**. Die Range kann einen vom Projekt **genutzten** Skill treffen, ohne
dass die Marker-Aussagen daran veralten — das ist der Zweck des Begehens. Diese Ergänzung
gilt neben „Der Cursor bleibt, was er ist: er nennt den **konsumierten** Stand": der Cursor
nennt weiter den **konsumierten** Stand, er wird nicht zum Rahmen einer Aussage.

Beleg — gemessen in diesem Repo und in den beiden Projektmarkern (read-only):

- Die Zeichenkette `Bezugsrahmen-Regel` steht im Skill-Verzeichnis am Stand `65fbecc`
  **4-mal** (`SKILL.md` **1**, `references/notes.md` **2**, `templates/AGENTS.skills.md`
  **1**) und an den Ständen `e523df9`, `21b29e4`, `7341bb0`, `992a9eb` **0-mal**
  (`git grep -c "Bezugsrahmen-Regel" <stand> -- .agents/skills/skills-marker/`).
- Beide Projektmarker zitieren die Stelle und tragen `agents-skills-consumed: 0449b05` —
  **7** Commits vor `65fbecc` (`git rev-list --count 0449b05..65fbecc` → **7**). An ihrem
  deklarierten Cursor existiert der Anker **nicht**. Keiner dieser **7** SHAs (`65fbecc`,
  `992a9eb`, `7341bb0`, `21b29e4`, `e523df9`, `7910ec6`, `d5dc52f`) kommt in `AGENTS.skills.md`
  oder im Board der beiden Projekte vor (`git show <stand>:<datei> | grep -c "<sha>"` → **0**
  Treffer je SHA und Datei, gemessen in `opencode-pwa` `a3e4a9f` und `LuminaRust` `207b6e4`) —
  die Range ist nicht begangen.
- Warum das erst auffällt: der Skill wird **live** aus dem Arbeitsbaum gelesen —
  `~/.config/opencode/opencode.jsonc` trägt `"skills": ["/projects/agents-skills/.agents/skills"]`,
  es gibt **keine** installierte Kopie. Der **Cursor** ist damit das Einzige, was die
  angewandte Regelversion pinnt.
- Die Range `0449b05..65fbecc` berührt **zwei** Skills (`git log --oneline 0449b05..65fbecc --
  .agents/skills/skills-marker/ | wc -l` → **5**, `… -- .agents/skills/ratchet-gates/ | wc -l` →
  **1**): `skills-marker` und `ratchet-gates` (der Text stand in
  `d7888cd:.agents/skills/ratchet-gates/references/cli.md:108`: „**No tag was pushed yet** …
  build from source" — und wurde von `d5dc52f` entfernt → die Releases sind veröffentlicht).
  Ein Begehen dieser Range trifft also einen vom Projekt genutzten Skill — die Zeile im Marker
  muss daran nicht veralten, sie wird neu gemessen.

### Eine Aufzählung trägt zwei Behauptungen

**Regel:** Eine Aufzählung trägt **zwei** Behauptungen: **jedes genannte Element trägt die
Eigenschaft** und **die Liste ist die ganze Menge**. Beide sind zu belegen. Eine Liste, die der
Commit selbst fortschreibt, **wächst nicht mit** — sie verliert bei jedem Commit ein Element;
ein **wanderndes** Element („dieser Commit") macht sie unprüfbar. Der Ersatz ist ein
**Kommando**, das die Menge ableitet — sonst trägt die Zahl eine Liste, die niemand
vollständig kennt.

Beleg — vier Instanzen aus dem Feld, gemessen read-only:

- `opencode-pwa`, Marker-Stand `b7c318a:AGENTS.skills.md:281-283`: „in der Marker-Serie
  (`docs(skills):`/`docs(agents):` — die Commits `1f73917`, `4507c4a`, `73c032f`, `c737d17`,
  `45cb323`, `c86138b` und dieser) haben **zwei** einen deutschen Body […]". Die **Handliste**
  nennt **sechs** SHAs und den Platzhalter „und dieser"; die Serie hat **zehn** Commits (`git log
  --oneline --grep='^docs(skills):' --grep='^docs(agents):' b7c318a` → **10**), und „und dieser"
  ist ein **wanderndes** Element: bei jedem Commit fällt der Vorgänger heraus. Die Zahl „zwei"
  stimmt — über die genannte Liste wie über die vollständige Serie; **falsch ist die Liste,
  nicht die Zahl**. **Behoben in `092d512`** durch das Kommando statt der Handliste.
- `open-accreditation`, Board-Stand `78051f0:AGENTS.todo.md:1317`: die Liste „**16** in Prosa"
  nennt **sechs** Dateien mit der Summe **17** — `AGENTS.todo.md` 5,
  `features/05-e2e-test-image.md` 4, `AGENTS.md` 3, `Agents.headless.md` 3,
  `frontend/playwright.config.ts` 1, `frontend/tests/e2e/helpers/admin-data.ts` 1 — und
  `frontend/playwright.config.ts` ist **doppelt** gezählt (es steht auch in der Gruppe „**14** in
  `ci.yml` und den beiden Playwright-Configs") und **Code**, keine Prosa. An den Ständen
  `dc3bcd2` und `734d7d1` stand dieselbe Liste noch richtig: **fünf** Dateien, Summe **16**,
  davon **15** in Markdown-Prosa und **1** als Prosa in einer Code-Kommentarzeile.
- `open-accreditation`, Body `78051f0`: „the body of 2da0404 contains 13 occurrences of „this
  commit" and all 13 refer to 2da0404 […]". Der Body von `2da0404` trägt „this commit" **13-mal**
  (`git show -s --format=%B 2da0404 | grep -c "this commit"` → **13**) — **12** davon verweisen auf
  `2da0404`, **eines** auf `3ad1309` (die Stelle im L4-Absatz: „9170e03 has an English subject
  AND an English body, so it does not follow the pattern of this commit"). Die „Widerlegung", die
  der Body `78051f0` für richtig hielt (`the earlier "three places and one place" was wrong`),
  greift ins Leere: `c353313` prüft den Body von **`2da0404`** (Subject: „docs(marker): fix the
  findings of the re-check of `2da0404` (N1–N6)"; der zitierte Satz steht nur dort) und nennt
  **dieselbe** Stelle — an einer Stelle
  bedeutet „this commit" dort `3ad1309` (die L4-Passage) —, und die **13** Stellen, von denen der
  Body spricht, tragen genau diese eine über `3ad1309`. Was `c353313` mit „three places and one
  place" genau gezählt hat, ist aus dem Body allein **nicht** rekonstruierbar.
- **Im Instrument selbst**: die Formulierung „die drei Regeln stehen dort als **Kurzform zur
  Erinnerung** […]" in dieser Datei war nach dem Hinzufügen der vierten Regel eine **veraltete
  Zahl** über einer
  gewachsenen Liste (am Stand `820c140` noch vorhanden — `git show 820c140:…/references/notes.md |
  grep "drei Regeln"` → Treffer —, behoben mit `37cefe2`); und die Verteilung „12/11/5/26" in
  `references/notes.md` (Stand `f7b8f9c`, Zeile 390) war **keine Partitionierung** der **54**
  Treffer — zwei Zeilen tragen mehr als ein Muster (behoben mit `820c140`; heute steht dort
  „priorisiert: **12/9/4/29**").

## Wo steht was

| Aussage | Datei |
|---|---|
| Welchen Stand dieses Projekt konsumiert hat | `<projekt>/AGENTS.skills.md` |
| Was **dieses Projekt** gelten muss (Kommandos, Schwellen, Gates) | `<projekt>/AGENTS.md` |
| Was als offene Position noch umzusetzen ist (Log, kein Auftrag) | `<projekt>/AGENTS.todo.md` |
| Wie dieses Format aussieht und wie man es fortschreibt | `<skills-repo>/.agents/skills/skills-marker/SKILL.md` |
| Wie eine Aussage über einen Stand zu belegen ist (Bezugsrahmen, Zitierform) | `<skills-repo>/.agents/skills/skills-marker/references/notes.md` § „Der Bezugsrahmen" |

Die fünf Aussagen überschneiden sich nicht. Der Verwechslungsfehler, den der Marker
verhindern soll, ist genau dieser: eine **globale** Skill-Regel als **projektlokale**
Pflicht zu behandeln (⇒ offene Position, die keiner braucht) oder eine echte
Projektpflicht zu übergehen, weil „die Skill sagt das ja sowieso" (⇒ stille Lücke).

## Ein Marker je Repo

Genau eine `AGENTS.skills.md` im Repo-Root. Monorepos mit mehreren Packages führen
**keine** zweite: sie referenzieren die Root-Datei. Zwei Marker bedeuten zwei Cursoren,
die auseinanderlaufen, und die Frage „welcher gilt?" ist teurer als die Arbeit, die sie
einsparen — zumal beide Dateien von Hand aktualisiert werden müssten und der
zuverlässigere davon still veraltet.

## Zwei Abläufe nach demselben Pull

(Kurzform: `SKILL.md` §5.) `agent-config` §8 = Konfiguration (Sache der Maschine),
`skills-marker` = Projekt-Anwendung (Sache des Projekts). Beide laufen nach demselben Pull,
sie treffen verschiedene Dateien, und
**keiner ersetzt den anderen**: die eingebettete Kopie einer Regel im globalen `AGENTS.md` ist
nicht die Zeile im Marker, und die Zeile im Marker ist nicht die eingebettete Kopie. Was
dieselbe Session noch tun muss, damit **diese Maschine** wieder stimmt — geänderte Regel in
die eingebettete Kopie, MCP, neue Skill-Verdrahtung — steht in `agent-config` §8.

**„Advancing ist kein Updating, der Marker akkumuliert, und Akkumulation verrottet"** — der
Satz stand in `SKILL.md` §5 (Schritt 6) und ist mit `f7b8f9c` entfallen, weil die **vierte
Regel** (der Verweis auf die Zitierstelle, `SKILL.md` §2) seinen Inhalt jetzt an der
Zitierstelle trägt: ein weitergerückter Cursor verlangt, dass
die **Range zwischen altem und neuem Cursor begangen** wird — das Fortschreiben ist mehr als
das Umschreiben einer Zahl. Der Rest des Satzes steht in `SKILL.md` §5 weiterhin („der Marker
akkumuliert, und Akkumulation verrottet").
