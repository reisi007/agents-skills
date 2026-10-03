---
name: Build Verify Flow
description: 'TRIGGER when a user-commissioned change in a git repo is about to be committed or pushed — at the START of any such task, not only when the user says "verify". NOT for research, questions, reading, or throwaway experiments. This is the flow the always-on rule (`~/dev/agents-skills/.agents/rules/build-verify.md`, Regel 0) points to for everything beyond the Kleinheits-Ausnahme. Covers: pull before changing, the Kleinheits-Check, delegation to an implementer subagent, the verify run with an independent verifier and its `nach-verify` flag, commit after EVERY verify round regardless of the verdict, Conventional Commits with a verify-round footer, amend on redo, one commit per task, push plus CI watch. Also TRIGGER when deciding whether a change is small enough to skip the loop, when a commit message should be written, when deciding between `git commit --amend` and a new commit, when a verifier must be told whether it is a redo, when a verdict was CHANGES REQUIRED, or when a repo''s AGENTS.md duplicates this flow.'
---

# Build Verify — pull, delegate, verify, commit, amend, push

Der Flow, nach dem gearbeitet wird. Das nicht-verhandelbare Minimum steht als
Always-on-Datei in `~/dev/agents-skills/.agents/rules/build-verify.md`, verdrahtet
über den `instructions`-Key der globalen Config — sie ist dadurch in **jeder** Session
im Kontext und ihre **Regel 0** verweist bei allem jenseits der Kleinigkeits-Ausnahme
ausdrücklich hierher. Der Flow startet auf **Auftrag** des Users und gilt für alles,
was committet werden soll; Recherche, Nachfragen und verwerfbares Ausprobieren sind
ausgenommen. Diese Datei ist **nur der Ablauf**. Begründungen, Belege,
Entscheidungstabellen und belegte Fehlermuster stehen in
[`references/notes.md`](references/notes.md); **was in einem konkreten Repo wann grün
sein muss, steht in dessen `AGENTS.md`.**

## Der Flow auf einen Blick

```
0  git pull --rebase          bevor wirklich geändert wird
1  Auftrag prüfen (TODO-Eintrag allein ist KEIN Auftrag) → in AGENTS.todo.md protokollieren
2  Kleinigkeits-Check → a) delegieren (Regelfall)  b) ODER selbst, wenn alle 4 Kriterien erfüllt sind
3  Verify-Lauf durch separaten Subagenten → APPROVED | CHANGES REQUIRED   (bei b entfällt)
4  Commit — IMMER, egal wie das Verdict lautet        ein Commit pro Task
5  bei CHANGES REQUIRED: fixen → Verify-Lauf mit nach-verify: true → git commit --amend
6  Push + CI bis grün beobachten — außer der User hat manuelle Verifikation angefordert
```

**Zwei Nummernsysteme:** Die Zahlen im Diagramm sind Schritte, die `Step`-Überschriften
sind Kapitel — 0 = Pull (Step 0), 1+2 = Auftrag/Delegation (Step 1), 3 = Verify (Step 2),
4 = Commit (Step 3), 5 = Redo (zu Verify/Commit, ohne eigene Überschrift), 6 = Push (Step 4).

**Die Reihenfolge ist nicht verhandelbar.** Gepullt wird *bevor* die erste Änderung
entsteht, committet wird *nach* dem Verify-Lauf — nicht davor und nicht erst bei
`APPROVED`.

## Step 0 — pullen, bevor wirklich geändert wird

```sh
git status --porcelain          # zuerst: ist der Baum überhaupt sauber?
git pull --rebase               # nur bei sauberem Baum
```

**Ein dirty Tree wird nicht automatisch weggeräumt.** `git stash --autostash`,
`git checkout .` oder ein blindes `git pull` nehmen Arbeit weg, die niemandem mehr
gehört. Wenn der Tree dirty ist: anhalten und fragen, wessen Arbeit das ist.

## Step 1 — delegieren, es sei denn, es ist Kleinigkeit

| Rolle | Wer | Darf |
|---|---|---|
| **Orchestrator** | Hauptagent | `AGENTS.md` / `AGENTS.todo.md` **lesen**; echte Entscheidungen immer loggen (globale Arbeitsregel), sonst schreiben nur nach der Kleinigkeits-Ausnahme. Delegieren, verifizieren lassen, committen |
| **Implementer** | Subagent | Code/Tests schreiben, Ziel-Dateien + vollständige Spezifikation |
| **Verifikator** | **anderer** Subagent | prüfen, messen, Befunde melden — **nicht** fixen |

**Kleinigkeits-Check:** Sind alle vier Kriterien aus
`~/dev/agents-skills/.agents/rules/build-verify.md`, Abschnitt `Kleinigkeits-Ausnahme`,
erfüllt, macht der Orchestrator die Änderung
selbst — mit Conventional Commit, Push + CI und dem Footer
`Verify: entfällt (Kleinigkeits-Ausnahme, 0 Runden)`. Sonst: delegieren, mit
Zieldateien und vollständiger Spezifikation.

**Der Verifikator ist nie der Implementierer desselben Tasks** — sein frischer
Kontext ist der ganze Zweck. Er darf Implementierer-Arbeit nicht zerstören:
`git checkout`, `git restore` und `git reset --hard` auf Pfade mit uncommitteten
Änderungen sind verboten. Ausweg: vorher committen, auf einer Kopie arbeiten, oder
ein bewusst dokumentiertes `git stash` mit `stash pop` am Ende. Passiert es trotzdem,
sofort und vollständig melden — inklusive welcher Aussage danach nicht mehr möglich
ist.

## Step 2 — der Verify-Lauf und sein `nach-verify`-Flag

Der Orchestrator übergibt dem Verifikator **ausdrücklich**, welcher Lauf das ist: ohne
Bezug zur Vor-Runde kann ein Redo-Lauf nicht unterscheiden, ob ein Befund behoben
oder nur verschoben wurde.

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

Ein `CHANGES REQUIRED` wird genauso committet wie ein `APPROVED` — der Commit ist der
Arbeitsstand, an dem die nächste Runde ansetzt. **Ein Commit pro Task**, nie eine
gemeinsame Welle.

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
optionaler Scope) für die Headline, der `Verify:`-Footer protokolliert die Runden.

**Amend oder neuer Commit?** Amend nur, solange HEAD der Verify-Commit **dieses**
Tasks ist, nichts davon gepusht wurde und keine fremde Arbeit im Baum liegt; sonst
neuer Commit. Die Entscheidungstabelle und die Reflog-Kommandos für den Delta der
letzten Runde stehen in [`references/notes.md`](references/notes.md).

## Step 4 — pushen und die CI beobachten

Nach dem Commit wird gepusht und die CI bis zum grünen Lauf verfolgt. **Einzige
Ausnahme:** der User hat ausdrücklich eine manuelle Verifikation angefordert — dann
nicht pushen, die CI aber weiter beobachten, falls es eine hat.

```sh
git push
gh run list -L 3                    # welche Läufe gestartet sind
gh run watch <run-id> --exit-status # bis grün oder rot
```

Ist die CI rot, hat deren Fix **Vorrang vor aller neuen Arbeit** — ein liegen
gebliebener roter Push wird sonst zur falschen Diagnose.
