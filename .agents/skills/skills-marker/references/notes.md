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

## Fallstrick: der Marker-SHA verschwindet

`agent-config` §6 amendet in diesem Repo und pusht mit `--force-with-lease`. Ein
amendeter Commit bekommt eine **neue** SHA — der alte Marker-SHA existiert dann nicht
mehr. Naiv angewendet heißt das `unknown revision` oder, schlimmer, „SHA weg, also
jetzt auf HEAD setzen", womit alles als geprüft gilt, was nie geprüft wurde.

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
