# Build-Verify — Notizen, Belege, Begründungen

Nicht geladen, nur gelesen, wenn jemand nach dem **Warum** fragt. Der Ablauf selbst
steht in [`../SKILL.md`](../SKILL.md), das nicht-verhandelbare Minimum in
`../../../rules/build-verify.md`. Alles hier ist Begründung zu einer dort getroffenen
Entscheidung — Regeln, die hier stehen, gelten nicht ohne ihre Entsprechung dort.

## Warum der Flow so geschnitten ist

- **Getrennte Implementierer- und Verifikator-Rollen.** Ein Verifikator, der denselben
  Kontext wie der Autor hat, prüft die eigenen Annahmen mit. Ein frischer Kontext ist
  der ganze Zweck des Loops — er hat die Annahmen nicht mitgebaut, die er prüft.
- **Committen nach jedem Lauf, unabhängig vom Verdict.** Der Commit ist der
  Arbeitsstand, an dem die nächste Runde ansetzt. Ohne ihn hat der nächste Agent
  keinen Rückweg, und jeder Abbruch verliert die Arbeit.
- **Der `Verify:`-Footer protokolliert die Runden.** Er ist der Grund, warum die
  Historie nach einem Amend trotzdem lesbar bleibt — sonst bliebe nur der Reflog.
- **Ein Commit pro Task.** `--amend` kann technisch immer nur `HEAD` umschreiben,
  nie einen früheren Commit. Zwei parallele Tasks als eine Welle zu committen trifft
  den falschen Commit oder scheitert; ein Task, der auf alle anderen wartet,
  blockiert die anderen.
- **`--rebase` statt Merge**, weil auf `main` konsolidiert wird — keine
  per-Task-Branches.
- **Verifikationsläufe sequenziell, nie parallel** (Regel 8). CPU-Überschreibung macht
  eine grüne Ampel ohne Aussagekraft.

## Kleinigkeits-Ausnahme (2026-10-03, User-Entscheidung)

Nicht jede Änderung braucht den Loop: bei einem Tippfehler kostet er zwei
Subagenten-Runden. Der Orchestrator macht Kleinigkeiten selbst — die **Schwelle ist
hart**, weil bei Kleinigkeiten niemand Unabhängiges gegenliest.

Die vier Kriterien stehen in `../../../rules/build-verify.md` (immer geladen, damit sie
ohne diesen Skill gelten) — hier nur ihre Herleitung, damit sie nicht auseinanderlaufen.
„K1" bis „K4" meinen diese vier Kriterien in der Reihenfolge der Immer-Regel:

- **Diff ≤ 30 Zeilen über den *gesamten* Task.** Pro Einzelschritt gemessen würde die
  Grenze umgangen werden: drei kleine Edits in drei Tasks oder ein Edit, der nach dem
  Selbst-Check erweitert wird, passen formal. Wird die Schwelle unterwegs gerissen,
  gilt ab da der volle Loop — das kostet nur Zeit, nicht Korrektheit.
- **„Bestehende Datei", kein neuer Config-Schlüssel, kein Identifier-Rename.** Eine neu
  angelegte 30-Zeilen-Datei erfüllt die Größen-Hälfte von K1, fällt aber durch die
  erste Hälfte (keine neue Datei) und durch K2. Doku, die einen Namen *präzisiert*,
  bleibt drin — der Rename eines Identifiers nicht.
- **„Verschärfte Pflicht/Schwelle" ist raus, „Begründungssatz" ist drin.** Das ist die
  schärfste offene Grenze der ganzen Ausnahme und genau der Fall, in dem der stille
  Fehler entsteht: eine Regel umformulieren ist harmlos, eine Pflicht verschärfen
  nicht.
- **Der Amend aus dem Verify-Redo-Pfad entfällt, der repo-spezifische nicht.** Die
  Amend-Regel in `agent-config §6` (`agents-skills` selbst) ist eine andere: sie
  betrifft die Branch-Policy dieses einen Repos, nicht den Redo-Pfad des Flows.

| drin | raus |
|---|---|
| `docs(x): clarify flag name`, Tippfehler in `AGENTS.md`, Port in `.env.example`, Begründungssatz zu einem bestehenden Schlüssel ergänzt, 12 Zeilen Kommentar | zwei kleine Dateien, neue Datei, Diff über 30 Zeilen (add + del, gesamter Task), Helper umbenennen, Bedingung ändern, neue Dependency, neue Regel **oder verschärfte Pflicht/Schwelle** in `AGENTS.md` oder einem Skill |

**Verworfene Alternativen** (bewusst nicht, siehe `~/.config/opencode/AGENTS.todo.md`
§Verworfen (Build-/Verify-Flow)): die Ausnahme abschaffen — dann bleibt jeder Tippfehler zwei Runden; und
die Ausnahme mit weiterhin verpflichtendem Verifikator — das ist bezahlte Reibung ohne
Aussagekraft. Wer die Unabhängigkeit abschafft, will den Loop abschaffen.

## Amend oder neuer Commit?

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

## Verifikator: was er nicht darf

`git checkout`, `git restore` und `git reset --hard` auf Pfade mit uncommitteten
Änderungen sind verboten — `git checkout` nimmt den **Index**, nicht den Commit-Stand,
ein Rückweg existiert dann nicht mehr. Zulässig sind nur: der Orchestrator hat den
Stand vorher committet (der Normalfall), der Verifikator arbeitet auf einer Kopie, oder
ein bewusst dokumentiertes `git stash` mit `stash pop` am Ende. Passiert es trotzdem,
ist es **sofort und vollständig** zu melden — inklusive der Angabe, welche Aussage
danach nicht mehr möglich ist.

## Verweise ohne (mehr) auffindbaren Beleg

Zwei Verweise bleiben bewusst ohne Beleg im Repo, damit hier keine erfundenen
Zitate landen:

- **`portal.reisinger.pictures/AGENTS.md` §5** — der dokumentierte Unfall mit
  weggeräumtem Working Tree (dort Punkt 6, **Stand vor 2026-10-02**; die Abschnitts-
  nummerierung hat sich seither verschoben, der Beleg ist nicht mehr auffindbar).
- **Roter Push, der liegen bleibt** — `open-accreditation/AGENTS.md` §5 (f) „CI-Grün
  hat immer Priorität, Vorrang vor aller neuen Arbeit". Der Satz gilt, der Verweis
  von hier dorthin wird nicht gepflegt, weil das Repo fremd ist.

## Project facts

Repo-spezifisch — **das steht in der `AGENTS.md` des jeweiligen Repos**, nicht hier:
Build-/Lint-/Test-Kommandos, E2E-Tags, Screenshot-Pflicht, Abhängigkeiten zwischen
Modulen, Sonderfälle ohne automatisierbaren Test (Lightroom-Restart, manuelle
Checklisten).

Falls eine `AGENTS.md` den Flow noch selbst ausformuliert statt auf diesen Skill zu
verweisen: **die Doppelnennung entfernen.** Zwei Regeln im selben Prompt haben keine
Rangfolge, und die schwächere gewinnt. Das gilt besonders für Zeilen wie „KEINE
Commits/Pushes ohne explizite Anweisung" — die widersprechen Step 3 (Commit) und
Step 4 (Push) direkt.

## Traps

| Trap | Was tatsächlich passiert | Stattdessen |
|---|---|---|
| Erster Verify-Lauf ohne Modus-Angabe | der Verifikator prüft den Baum wie nach einer Korrektur und meldet „passt“ — ohne Bezug zu den Befunden | `nach-verify:`-Flag bei **jedem** Lauf mitgeben |
| `git checkout <datei>` beim Mutationstest | zerstört uncommittete Arbeit des Implementierers; kein Rückweg existiert dann mehr | vorher committen (Step 3, Commit), Kopie, oder dokumentiertes `git stash` |
| `git add -A` in einem geteilten Baum | zieht die Arbeit eines **gleichzeitig laufenden** Agenten mit auf: belegt ein Commit mit 14 Dateien / 408 Zeilen aus `features/`, die nicht seine waren — Inhalt korrekt, Nachricht falsch, Historie fortan irreführend | immer explizite Pfade; `git show --stat` vor dem Commit |
| Erst bei `APPROVED` committen | der Arbeitsstand zwischen den Runden existiert nur im Working Tree; jeder Abbruch verliert ihn | nach **jedem** Verify-Lauf committen, Verdict egal |
| Amend, obwohl schon gepusht | `git push --force` auf einem gelesenen Stand überschreibt fremde Commits | `--force-with-lease`, und im Regelfall: gar nicht erst amendieren |
| Commit aus einer Welle paralleler Tasks | `--amend` trifft den falschen Commit oder scheitert; ein `revert` zieht dann fremde Arbeit mit | ein Commit pro Task |
| Zwei volle Suites parallel fahren | CPU-Überschreibung: Testzeiten blähen um 3–5× auf (gemessen 14 → 56 ms), ein Reserve-Test riss ein 10-s-Budget, obwohl er intrinsisch ~563 ms kostet — grün ohne Aussagekraft | Verifikationsläufe **sequenziell**, auch gemischt (Backend neben Frontend) |
| Einen lokal roten, in CI grünen Test als Code-Defekt behandeln | drei belegte Fälle in `portal.reisinger.pictures` — Umgebung, nicht Defekt (`Storage::fake`-Pfad, `E2E_CHECKOUT_LIMIT`, Shard-Last) | erst die Umgebung prüfen; keine zweite Hypothese erfinden, um die erste passend zu machen |
| `pnpm add` / Dependency-Änderung ohne Rückfrage | verändert Lockfile und CI-Zeit ohne Auftrag | nachfragen, wie in `angular-material-extended/AGENTS.md` §19 |
| Doku-only-Commit in einem Repo ohne `paths-ignore` | die volle Pipeline startet für einen Satz: in einem gemessenen Fall 11 Jobs inkl. 6 Playwright-Shards | siehe Skill `github-ci-filters` |
| Dirty Tree eigenmächtig wegräumen | `git stash --autostash` oder ein blindes `git pull` nehmen Arbeit weg, die niemandem mehr gehört | anhalten und fragen, wessen Arbeit das ist |
