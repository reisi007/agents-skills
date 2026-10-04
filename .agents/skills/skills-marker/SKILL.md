---
name: Skills Marker
description: 'TRIGGER when a git pull landed in the agents-skills repo, when asking which state of the skills a project consumes (Marker, Stand: welche Skills wurden angewendet?), when a skill changed and a project must be checked against it, or when scaffolding a new project. AGENTS.skills.md is the per-project marker: which commit was checked, which skills were applied, which not and why — worked as the concrete range <marker-sha>..HEAD. Also TRIGGER on drift between skills repo and project, on a new or extended skill version, on deciding whether a skill change applies to this repo at all, and when advancing a marker.'
---

# Skills-Marker — welcher Stand der Skills in diesem Projekt angekommen ist

**Kernregel:** Jedes Projekt hält in `AGENTS.skills.md` **einen SHA und ein Datum** —
den Commit des Skills-Repos, **bis zu dem** es geprüft hat, und wann. Alles andere ist
eine Zeile in der Tabelle darunter. Die Datei ist ein **Cursor, kein Archiv und kein
Auftrag**: sie wird **nicht abgearbeitet**, sondern bei jedem `git pull` im Skills-Repo
fortgeschrieben — dieselbe Unterscheidung, die der `build-verify`-Flow für
`AGENTS.todo.md` trifft.

Der Nutzen: aus „lies den Diff und rate, was davon dieses Projekt betrifft" wird eine
konkrete Liste. `git log <marker-sha>..HEAD` benennt jeden geänderten oder neuen Skill,
und für jeden steht danach eine Zeile im Marker. Diese Datei ist **der Ablauf** (Details: `references/notes.md`); was gelten
muss, steht in dessen `AGENTS.md` — der Marker hält Prüfungen fest, keine Pflichten.

## 1. Wo die Datei liegt

| Datei | Ort | Rolle |
|---|---|---|
| Vorlage | `<skills-repo>/.agents/skills/skills-marker/templates/AGENTS.skills.md` | Gerüst zum Kopieren |
| Marker | `<projekt>/AGENTS.skills.md`, neben `AGENTS.md`/`AGENTS.todo.md` | **genau eine** je Repo |
| Format | `<skills-repo>/.agents/skills/skills-marker/SKILL.md` (diese Datei) | wird hier festgelegt, nicht im Projekt |

Der Marker liegt im **Projekt** und nennt nur den SHA, nie einen Pfad zum
Skills-Repo — Begründung in [`references/notes.md`](references/notes.md).

**`AGENTS.skills.md` heißt bewusst nicht `AGENTS.md`:** sie wird beim Trigger
gelesen, nicht in jede Session injiziert.

## 2. Format und Vorlage

```sh
cp <skills-repo>/.agents/skills/skills-marker/templates/AGENTS.skills.md \
   <projekt>/AGENTS.skills.md
```

| Feld | Bedeutung |
|---|---|
| `agents-skills-consumed:` | der Commit des Skills-Repos, **bis zu dem** geprüft wurde |
| `geprüft am:` | ISO-Datum des Prüflaufs |
| `## Skill-Stand` | Tabelle: `Skill \| angewendet? \| wo im Projekt \| offene Position` |
| `## Offen aus dem Bereich <alt>..<neu>` | genau die Skills, die in dieser Range neu dazugekommen oder geändert wurden |

Kopieren genügt: die Vorlage ist ein **lauffähiges Gerüst** (leere Tabelle,
Fortschreib-Anleitung). HTML-Kommentare darin sind Arbeitsanleitung und
fallen beim ersten Fortschreiben weg.

**SHA + Datum, sonst nichts.** Keine Version, keine Zähler — Begründung und
Beispiel-Range in [`references/notes.md`](references/notes.md).

**Angewendet** heißt **am Code geprüft**, nicht gelesen — Auswahlregel in §4.

## 3. Die Range — was seit dem Marker passiert ist

```sh
# 1. Marker lesen → <marker-sha>
cat <projekt>/AGENTS.skills.md

# 2. im Skills-Repo die Range bilden (erst NACH dem Pull!)
git -C <skills-repo> log --oneline <marker-sha>..HEAD
git -C <skills-repo> diff --stat <marker-sha>..HEAD
git -C <skills-repo> log --diff-filter=A --name-only <marker-sha>..HEAD -- .agents/skills   # neue Skills
git -C <skills-repo> log --name-only --format= <marker-sha>..HEAD -- .agents/skills | sort -u   # alle berührten Skills
```

Der letzte Befehl ist der Arbeitsauftrag: die Liste der Skills, die gegen
**dieses** Projekt geprüft werden **müssen**. Range immer **nach** dem Pull
bilden (Fälle und Begründung: `references/notes.md`).

**Für jeden dieser Skills gilt genau eine von drei Entscheidungen:**

| Ergebnis | Eintrag im Marker |
|---|---|
| Trifft zu **und** ist drin | `angewendet: ja` \| `wo im Projekt` = `Datei:Zeile` \| offene Position leer |
| Trifft zu, ist aber nicht drin | `offene Position` = Verweis auf den Eintrag in `AGENTS.todo.md` |
| Trifft nicht zu | `angewendet: nein` \| kurzer Grund: „betrifft CI-Image, Repo hat keins" |

Die zweite Zeile ist der wichtigste Fall: Neues, das hier nicht umgesetzt ist,
wandert als **Log, kein Auftrag** nach `AGENTS.todo.md` (`build-verify`) —
nie stillschweigend übersprungen, nie als erledigt markiert.

Erst wenn für **jeden** Skill aus der Range eine dieser drei Zeilen steht, wird der
Marker auf den neuen SHA gesetzt. Nie vorher: ein Marker, der auf einen SHA zeigt, bis zu
dem nicht alles geprüft ist, ist eine Lüge, die sich erst beim nächsten Pull auffällt —
und dann ist die Range weg, mit der man sie hätte aufdecken können.

## 4. Wann trifft eine Skill-Änderung dieses Projekt zu?

**Trifft zu**, wenn die Änderung etwas beschreibt, das **dieses Projekt selbst
festlegt**: eine Pflicht, eine Schwelle, eine Ausnahme, eine Konvention oder ein
Kommando, das hier gilt — also etwas, das in `AGENTS.md`, in einem Workflow, in einem
Hook, in einer Package-Script-Datei oder in einer Dockerfile dieses Repos steht oder
stehen müsste.

**Trifft nicht zu**, wenn sie etwas beschreibt, das dieses Projekt gar nicht hat: die
Fallhöhe eines Docker-Test-Images in einem Repo ohne CI-Image, Sharding-Vorgaben in einem
Projekt ohne E2E-Suite, ein Commit-Schema in einem Wegwerf-Skript. Der Grund gehört in
die Tabelle — „trifft nicht zu, weil …" ist das **Ergebnis** der Prüfung, kein Weg
daran vorbei. Ohne Grund wird die Zeile beim nächsten Pull unprüfbar.

Die Frage ist nie „ist die Änderung wichtig", sondern „regelt sie hier etwas, das es
hier gibt". Sie ist meist in einem Satz entschieden, weil eine gute Änderung ihren
Geltungsbereich mitliefert: steht dort „in jedem Projekt" oder „in CI-Workflows mit …",
ist die Antwort sofort klar — und im Zweifel gewinnt **ja** mit offener Position,
nicht **nein**.

**Konventionen sind Zeilen, keine Annahmen:** Sprache (Englisch für die Skills
in diesem Repo), Größen-Disziplin (`SKILL.md` ~150 Zeilen, Überlauf nach
`references/`) und eingebettete Always-on-Regeln (inlined, `agent-config` §2a)
bekommen je eine Tabellenzeile wie jeder Skill.

## 5. Nach einem `git pull` im Skills-Repo

1. **Marker lesen** → `<marker-sha>`. Fehlt die Datei, ist das Projekt nicht gescaffoldet
   — `codegraph-project-setup`, Schritt 2.5.
2. **Range bilden** (Kommandos aus §3) → Liste der betroffenen Skills.
3. **Regel-Drift prüfen:** `.agents/rules/*` gegen die eingebetteten Kopien in
   der globalen `~/.config/opencode/AGENTS.md` diffen — eine neuere Regeldatei
   ist Drift, bis die Kopie nachgezogen ist (`agent-config` §8).
4. **Jeden Skill gegen das Projekt prüfen** (§4) → ja / nein + Grund.
5. **Offene Positionen nach `AGENTS.todo.md`**, Belege als `Datei:Zeile`.
6. **Marker fortschreiben**: `agents-skills-consumed` auf
   `git -C <skills-repo> rev-parse --short HEAD`, `geprüft am` auf heute, Tabellen- und
   Bereichs-Abschnitt ersetzen.
7. **Reload**, falls Regeln oder Skills betroffen sind:
   `touch ~/.config/opencode/opencode.jsonc` (→ `agent-config` §2a).

Was dieselbe Session noch tun muss, damit **diese Maschine** wieder stimmt — neue
Regel-Datei in den `instructions`-Array, MCP, neue Skill-Verdrahtung — steht in
`agent-config` §8 und wird hier nicht wiederholt. Die Trennung ist strikt:
**`agent-config` §8 = Konfiguration (Sache der Maschine), `skills-marker` =
Projekt-Anwendung (Sache des Projekts).** Beide laufen nach demselben Pull, sie treffen
verschiedene Dateien, und keiner ersetzt den anderen.

## 6. Anti-Patterns

| Muster | Warum es schadet | Stattdessen |
|---|---|---|
| Den Marker wegschieben, weil eine Änderung „nicht wichtig" wirkt | Genau solche Änderungen waren in der Praxis die wichtigen — das ist der Fall, in dem sie wichtig waren | prüfen, eintragen, **dann** weiterschieben |
| Einen Skill als „angewendet" markieren, nachdem nur die Doku gelesen wurde | Angewendet heißt am Code geprüft; sonst verliert der Marker genau die Aussage, für die er da ist | `Datei:Zeile` als Beleg — oder offene Position |
| Eine offene Position als „trifft nicht zu, weil klein" wegkassieren | Solche Begründungen stehen im nächsten Range-Log ohne ihr Prüfergebnis | die Auswahlregel aus §4 anwenden und den Grund aufschreiben |
| Zahlen in den Marker schreiben („5 Skills offen", „80 % angewendet") | Sie veralten still und werden falsch, ohne dass etwas alarmiert | SHA + Datum; Zahl bei Bedarf aus der Range neu berechnen |
| Zwei Marker je Repo (eine in `docs/` als „richtige" Version) | Zwei Cursoren laufen auseinander; welcher gilt, ist dann eine Vermutung | genau eine, Repo-Root; Subpackages verweisen auf sie |
| Den Marker im Skills-Repo führen | Er behauptet etwas über ein Projekt; im Skills-Repo wäre er nur eine Behauptung über fremde Standorte | Marker im Projekt |
| Nach einem Pull nur den geänderten Skill lesen, Marker unangetastet lassen | Der nächste Pull bildet dieselbe Range erneut — jedes Mal dieselben Commits prüfen | Marker in **jedem** Pull-Zyklus fortschreiben |
