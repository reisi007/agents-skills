---
name: Build Verify Flow
description: TRIGGER whenever code, config or docs in a git repo are about to be changed, committed or pushed — at the START of any such task, not only when the user says "verify". Covers the full flow: pull before changing, orchestrator never implements, independent verifier, the `nach-verify` flag for a redo run, commit after EVERY verify round regardless of the verdict, Conventional Commits with a verify-round footer, amend on redo, one commit per task, push plus CI watch. Also TRIGGER when a commit message should be written, when deciding between `git commit --amend` and a new commit, when a verifier must be told whether it is a redo, when a verdict was CHANGES REQUIRED, or when a repo's AGENTS.md duplicates this flow.
---

# Build Verify — pull, delegate, verify, commit, amend, push

Der Flow, nach dem gearbeitet wird. Das nicht-verhandelbare Minimum steht als
Always-on-Datei in `~/dev/agents-skills/.agents/rules/build-verify.md`, verdrahtet über
den `instructions`-Key der globalen Config — sie ist dadurch in **jeder** Session im
Kontext, dieser Skill nur bei Bedarf. **Dieser Skill ist die Detailfassung** — Amend-Entscheidungen,
Commit-Schema, Verifikator-Prompt, belegte Fehlermuster. Der vollständige Flow gilt
generisch; **was in einem konkreten Repo wann grün sein muss, steht in dessen
`AGENTS.md`, nicht hier.**

## Der Flow auf einen Blick

```
0  git pull --rebase          bevor wirklich geändert wird
1  Orchestrator: Anforderung → AGENTS.todo.md
2  Delegation an Implementer-Subagent      (Orchestrator schreibt keinen Code)
3  Verify-Lauf durch separaten Subagenten → APPROVED | CHANGES REQUIRED
4  Commit — IMMER, egal wie das Verdict lautet        ein Commit pro Task
5  bei CHANGES REQUIRED: fixen → Verify-Lauf mit nach-verify: true
                          → git commit --amend
6  Push + CI bis grün beobachten — außer der User hat manuelle Verifikation angefordert
```

Die Reihenfolge ist nicht verhandelbar, aber **Schritt 0 und Schritt 4 sind es am
häufigsten**: gepullt wird *bevor* die erste Änderung entsteht, und committet wird
*nach dem Verify-Lauf*, nicht davor und nicht erst bei `APPROVED`.

## Step 0 — pullen, bevor wirklich geändert wird

```sh
git status --porcelain          # zuerst: ist der Baum überhaupt sauber?
git pull --rebase               # nur bei sauberem Baum
```

**Ein dirty Tree wird nicht automatisch weggeräumt.** `git stash --autostash`,
`git checkout .` oder ein blindes `git pull` nehmen Arbeit weg, die niemandem mehr
gehört — in einem geteilten Working Tree ist das der dokumentierte Unfall aus
`portal.reisinger.pictures/AGENTS.md` §5 (dort Punkt 6, Stand vor 2026-10-02; der
Beleg steht heute als Trap in diesem Skill). Wenn der Tree dirty ist: anhalten und
fragen, wessen Arbeit das ist.

`--rebase` statt Merge, weil auf `main` konsolidiert wird (keine per-Task-Branches).

## Step 1 — drei Rollen, eine Trennung

| Rolle | Wer | Darf |
|---|---|---|
| **Orchestrator** | Hauptagent | `AGENTS.md` / `AGENTS.todo.md` lesen und klein editieren, delegieren, verifizieren lassen, committen |
| **Implementer** | Subagent | Code/Tests schreiben, Ziel-Dateien + vollständige Spezifikation |
| **Verifizator** | **anderer** Subagent | prüfen, messen, Befunde melden — **nicht** fixen |

Der Verifikator ist **nie** der Implementer desselben Tasks. Ein frischer Kontext ist
der ganze Zweck: er hat die Annahmen nicht mitgebaut, die er prüfen soll.

**Der Verifikator darf Implementierer-Arbeit nicht zerstören.** `git checkout`,
`git restore` und `git reset --hard` auf Pfade mit uncommitteten Änderungen sind
verboten. Zulässig sind nur: der Orchestrator hat den Stand vorher committet (der
Normalfall — Schritt 4), der Verifikator arbeitet auf einer Kopie, oder ein
bewusst dokumentiertes `git stash` mit `stash pop` am Ende. Passiert es trotzdem, ist
es **sofort und vollständig** zu melden — inklusive der Angabe, welche Aussage danach
nicht mehr möglich ist.

## Step 2 — der Verify-Lauf und sein `nach-verify`-Flag

Der Orchestrator übergibt dem Verifikator **ausdrücklich**, welcher Lauf das ist. Das
ist kein Detail: ohne den Bezug zur Vor-Runde kann ein Redo-Lauf nicht unterscheiden,
ob ein Befund behoben oder nur verschoben wurde.

| Modus | Flag | Was der Verifikator zusätzlich liefert |
|---|---|---|
| Erster Lauf | `nach-verify: false` | voller Lauf: Diff-Review, alle Kommandos aus der `AGENTS.md`, Architektur-/Security-Review, Befunde mit `Datei:Zeile` + `critical/high/medium/low` |
| Redo-Lauf | `nach-verify: true` | zusätzlich: **welche Befunde der Vor-Runde behoben sind, welche nicht, welche neu sind** + Gegenprobe, dass kein Fix den Befund nur verschoben hat |

`critical`/`high` blockieren `APPROVED` und werden als eigene Fix-Tasks delegiert.
Ein Verdict ohne vollständigen Befunde-Bericht wird nicht akzeptiert.

**Prompt-Template für den Verifikator:**

```
Projekt: <pfad>   Task: <was>
nach-verify: <true|false>
Vor-Runde: <letztes Verdict + Befundliste>       (nur bei true)

Prüfe: <Kommandos aus der AGENTS.md dieses Repos>
Liefere: Verdict APPROVED | CHANGES REQUIRED, Befunde mit Datei:Zeile + Schweregrad.
Bei nach-verify: true zusätzlich eine Liste je Vor-Befund — behoben / offen / neu —
mit dem Beleg, woran du das festmachst.
Fasse dich in Nichts, was du nicht belegen kannst.
```

## Step 3 — nach jedem Verify-Lauf committen, egal wie das Verdict lautet

**Das ist der Teil, der leicht übersprungen wird.** Ein `CHANGES REQUIRED` wird
genauso committet wie ein `APPROVED` — der Commit ist der Arbeitsstand, an dem die
nächste Runde ansetzt. Ohne ihn hat der nächste Agent keinen Rückweg.

**Ein Commit pro Task.** Zwei parallele Tasks bekommen zwei Commits, keine
gemeinsame Welle: `--amend` kann technisch immer nur `HEAD` umschreiben, nie einen
früheren Commit. Ein Task, der erst committet, wenn alle anderen fertig sind,
blockiert die anderen.

```sh
git add <datei1> <datei2> …        # explizite Pfade, NIE git add -A
git show --stat                    # Inhaltsprüfung vor dem Commit
git commit -F - <<'MSG'
feat(pricing): add peak-window calculation for z.ai plans

Verify: Runde 1 CHANGES REQUIRED (2 Befunde: 1 high, 1 medium)
Verify: Runde 2 APPROVED (behoben: f64-Overflow bei 1M-Peak, fehlender Test)
MSG
```

**Commit-Schema:** Conventional Commits (`feat|fix|docs|refactor|test|chore|perf` +
optionaler Scope) für die Headline. Der `Verify:`-Footer protokolliert die Runden —
er ist der Grund, warum die Historie nach einem Amend trotzdem lesbar bleibt.

### Amend oder neuer Commit?

| | Amend | Neuer Commit |
|---|---|---|
| Bedingung | HEAD ist der Verify-Commit **dieses** Tasks **und** nichts davon ist gepusht **und** keine fremde Arbeit liegt im Baum | alles andere |
| Wann | Redo-Lauf desselben Tasks nach `CHANGES REQUIRED` | neuer Task, fremder Commit dazwischen, schon gepusht, fremde Arbeit im Baum |
| Commit-Message | Headline bleibt, `Verify:`-Footer bekommt die neue Runde | neuer `feat:`/`fix:`/`docs:`-Commit |

Was sich **innerhalb** der Runde geändert hat, steht nach dem Amend im Reflog:

```sh
git diff HEAD@{1} HEAD      # Delta der letzten Runde
git log --oneline -3        # Commit-Historie des Tasks
```

## Step 4 — pushen und die CI beobachten

Nach dem Commit wird gepusht und die CI bis zum grünen Lauf verfolgt. **Einzige
Ausnahme:** der User hat ausdrücklich eine manuelle Verifikation angefordert („ich
schau selbst, bevor du pusht") — dann nicht pushen, die CI aber weiter beobachten,
falls das Repo eine hat.

```sh
git push
gh run list -L 3                    # welche Läufe gestartet sind
gh run watch <run-id> --exit-status # bis grün oder rot
```

Ist die CI rot, hat deren Fix **Vorrang vor aller neuen Arbeit** (belegt in
`open-accreditation/AGENTS.md` §5: ein roter Push, der liegen bleibt, wird zur
falschen Diagnose).

## Traps

| Trap | Was tatsächlich passiert | Stattdessen |
|---|---|---|
| Erster Verify-Lauf ohne Modus-Angabe | der Verifikator prüft den Baum wie nach einer Korrektur und meldet „passt" — ohne Bezug zu den Befunden | `nach-verify:`-Flag bei **jedem** Lauf mitgeben |
| `git checkout <datei>` beim Mutationstest | zerstört uncommittete Arbeit des Implementierers; `git checkout` nimmt den **Index**, nicht den Commit-Stand — ein Rückweg existiert dann nicht mehr | vorher committen (Schritt 4), Kopie, oder dokumentiertes `git stash` |
| `git add -A` in einem geteilten Baum | zieht die Arbeit eines **gleichzeitig laufenden** Agenten mit auf: belegt ein Commit mit 14 Dateien / 408 Zeilen aus `features/`, die nicht seine waren — Inhalt korrekt, Nachricht falsch, Historie fortan irreführend | immer explizite Pfade; `git show --stat` vor dem Commit |
| Erst bei `APPROVED` committen | der Arbeitsstand zwischen den Runden existiert nur im Working Tree; jeder Abbruch verliert ihn | nach **jedem** Verify-Lauf committen, Verdict egal |
| Amend, obwohl schon gepusht | `git push --force` auf einem gelesenen Stand überschreibt fremde Commits | `--force-with-lease`, und im Regelfall: gar nicht erst amendieren |
| Commit aus einer Welle paralleler Tasks | `--amend` trifft den falschen Commit oder scheitert; ein `revert` zieht dann fremde Arbeit mit | ein Commit pro Task |
| Zwei volle Suites parallel fahren | CPU-Überschreibung: Testzeiten blähen um 3–5× auf (gemessen 14 → 56 ms), ein Reserve-Test riss ein 10-s-Budget, obwohl er intrinsisch ~563 ms kostet — grün ohne Aussagekraft | Verifikationsläufe **sequenziell**, auch gemischt (Backend neben Frontend) |
| Einen lokal roten, in CI grünen Test als Code-Defekt behandeln | drei belegte Fälle in `portal.reisinger.pictures` — Umgebung, nicht Defekt (`Storage::fake`-Pfad, `E2E_CHECKOUT_LIMIT`, Shard-Last) | erst die Umgebung prüfen; keine zweite Hypothese erfinden, um die erste passend zu machen |
| `pnpm add` / Dependency-Änderung ohne Rückfrage | verändert Lockfile und CI-Zeit ohne Auftrag | nachfragen, wie in `angular-material-extended/AGENTS.md` §19 |
| Doku-only-Commit in einem Repo ohne `paths-ignore` | die volle Pipeline startet für einen Satz: in einem gemessenen Fall 11 Jobs inkl. 6 Playwright-Shards | siehe Skill `github-ci-filters` |

## Project facts

Repo-spezifisch — **das steht in der `AGENTS.md` des jeweiligen Repos**, nicht hier:
Build-/Lint-/Test-Kommandos, E2E-Tags, Screenshot-Pflicht, Abhängigkeiten zwischen
Modulen, Sonderfälle ohne automatisierbaren Test (Lightroom-Restart, manuelle
Checklisten).

Falls eine `AGENTS.md` den Flow noch selbst ausformuliert statt auf diesen Skill zu
verweisen: **die Doppelnennung entfernen.** Zwei Regeln im selben Prompt haben keine
Rangfolge, und die schwächere gewinnt. Das gilt besonders für Zeilen wie „KEINE
Commits/Pushes ohne explizite Anweisung" — die widersprechen Schritt 4 und 7 direkt.