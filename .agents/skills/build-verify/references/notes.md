# Build-Verify — notes, evidence, rationale

Not loaded, only read when someone asks **why**. The sequence itself lives in
[`../SKILL.md`](../SKILL.md), the non-negotiable minimum in
`../../../rules/build-verify.md`. Everything here is rationale for a decision
taken there — rules stated here apply only through their counterpart there.

## Why the flow is cut this way

- **The flow is a commit flow.** It governs work that gets committed, and it
  starts on commission. Research, questions, lookups, testing assumptions, and
  throwaway experiments run without pull, subagent, verify, commit, or TODO
  entry — there interactivity counts, and a process getting in the way costs more
  than the wrong config just being tried out. The test for it is simple: **will
  it be committed, or is it interaction?**
- **A TODO entry is a log, not an order.** Creating it stays mandatory, working
  it off does not — otherwise the agent invents tasks for itself out of a
  checklist that actually logs decisions. A `[ ]` entry alone triggers no verify
  run; only the order does.
- **Separate implementer and verifier roles.** A verifier sharing the author's
  context co-checks its own assumptions. A fresh context is the whole point of
  the loop — it did not co-build the assumptions it checks.
- **Commit after every run, regardless of the verdict.** The commit is the work
  state the next round starts from. Without it the next agent has no way back,
  and every abort loses the work.
- **The `Verify:` footer logs the rounds.** It is why history stays readable
  after an amend — otherwise only the reflog would remain. The
  `Verify: none (Kleinheits-Ausnahme, 0 rounds)` footer is not dropped either —
  otherwise later no one can tell whether a run happened at all.
- **One commit per task** — the reason lives under "Amend or new commit?"
  below. Committing two parallel tasks as one wave hits the
  wrong commit or fails; one task waiting for all others blocks the others.
- **`--rebase` instead of merge**, because `main` is consolidated onto — no
  per-task branches.
- **Verification runs sequential, never parallel** (Rule 8). CPU oversubscription
  produces a green light with no meaning.

## Kleinheits-Ausnahme

Not every change needs the loop: on a typo it costs two subagent rounds. The
orchestrator does trivia itself — the bar is deliberately set **wide** (see K1
in the always-on rule), because nobody independent re-reads trivia; K2 through
K4 carry the risk, not the size.

The four criteria live in `../../../rules/build-verify.md` (always loaded, so
they hold without this skill) — here only their derivation, so the two don't
drift apart. "K1" through "K4" mean those four criteria in the always-on rule's
order:

- **K1 is deliberately wide, K2 through K4 are the real boundaries.** A change
  at the K1 size is reviewable without a second agent
  re-reading it. What it must not be is governed by K2 through K4 — that is
  where the failure potential lies. Measured per single step, the size half
  would be circumvented (three small edits in three tasks), hence "measured over
  the whole task".
- **New config keys are in if no application code reads them.** Test: does
  application code read the key? Yes → full loop. No → in. Example: a new role
  in `opencode.jsonc` stays in, a new field in a config file read by application
  code does not. Tool configuration is the one exception: anything touching
  permissions, plugins, `instructions`, or hooks is out even with no reader —
  the `permissions` skill exists for that.
- **New files are in.** A new docs file is no code risk. **Deleted ones too —
  but only docs and pure text files;** a deleted file that contained logic is
  out. (K2 checks what is written, not what is deleted — hence the boundary
  lives here.)
- **"Tightened duty/threshold" is out, "rationale sentence" is in.** This is the
  sharpest open boundary of the whole exception and exactly the case that
  produces the silent failure: rephrasing a rule is harmless, tightening a duty
  is not.
- **The amend from the verify-redo path is omitted, the repo-specific one is
  not.** The amend rule in `agent-config` §6 (`agents-skills` itself) is a
  different one: it concerns that one repo's branch policy, not the flow's redo
  path.
- **The test is not "is it easy" but "is it clearly under the bar."** Two rounds
  for a cheap task cost less than a feature with a silent defect.

| in | out |
|---|---|
| `docs(x): clarify flag name`, typo in `AGENTS.md`, port in `.env.example`, rationale sentence for an existing rule, new docs file, new role in `opencode.jsonc`, 4 language files at 20 lines each | more than 5 files or more than ~80 lines (add + del, whole task), logic, control flow, API/signature change, new dependency, build/test/schema change, new field in an application-code-read config, anything touching permissions, plugins, `instructions`, or hooks, a new rule **or tightened duty/threshold** in `AGENTS.md` or a skill |

**Discarded alternatives** (deliberately not, see `~/.config/opencode/AGENTS.todo.md`
§Verworfen (Build-/Verify-Flow)): scrapping the exception — then every typo costs
two rounds; and keeping the exception with a still-mandatory verifier — that is
paid friction with no signal. Abolish independence and you abolish the loop.

## Amend or new commit?

Moved to [`amend.md`](amend.md): the amend-vs-new-commit decision table and the
reflog commands for the last round's delta. Rationale kept here: amend rewrites
`HEAD` only, never an earlier commit — so two parallel
tasks committed as one wave hit the wrong commit or fail, and one task waiting
for all others blocks the others.

## Verifier: what it must not do

`git checkout`, `git restore`, and `git reset --hard` on paths with uncommitted
changes are forbidden — `git checkout` takes the **index**, not the commit state,
and then no way back exists. Only these are admissible: the orchestrator
committed the state beforehand (the normal case), the verifier works on a copy,
or a deliberately documented `git stash` with a `stash pop` at the end. If it
happens anyway, report it **immediately and completely** — including which
statement can no longer be made afterwards.

## References without (still) retrievable evidence

Two references deliberately stay without evidence in the repo, so no invented
quotes land here:

- **`portal.reisinger.pictures/AGENTS.md` §5** — the documented accident with a
  cleared-away working tree (point 6 there; the section numbering has since
  shifted, the evidence is no longer retrievable).
- **Red push left lying around** — `open-accreditation/AGENTS.md` §5 (f) "CI
  green always takes priority, ahead of all new work". The sentence holds; the
  reference from here to there is not maintained because the repo is foreign.

## Project facts

Repo-specific — **that lives in each repo's `AGENTS.md`**, not here:
build/lint/test commands, E2E tags, screenshot duty, dependencies between
modules, special cases without an automatable test (Lightroom restart, manual
checklists).

If an `AGENTS.md` still spells out the flow itself instead of pointing at this
skill: **remove the duplication.** Two rules in the same prompt have no rank
order, and the weaker one wins. That holds especially for lines like "NO
commits/pushes without explicit instruction" — they contradict Step 3 (commit)
and Step 4 (push) directly.

## Traps

| Trap | What actually happens | Instead |
|---|---|---|
| First verify run without a mode flag | the verifier checks the tree as if after a fix and reports "fits" — with no reference to the findings | pass the `nach-verify:` flag on **every** run |
| `git checkout <file>` during mutation testing | destroys the implementer's uncommitted work; no way back exists then | commit beforehand (Step 3, commit), a copy, or a documented `git stash` |
| `git add -A` in a shared tree | pulls in a **concurrently running** agent's work: evidenced by a commit with 14 files / 408 lines from `features/` that were not its own — content correct, message wrong, history misleading from then on | always explicit paths; `git show --stat` before the commit |
| Only committing on `APPROVED` | the work state between rounds exists only in the working tree; every abort loses it | commit after **every** verify run, verdict irrelevant |
| Amending although already pushed | `git push --force` on a read state overwrites foreign commits | `--force-with-lease`, and normally: don't amend in the first place |
| Commit from a wave of parallel tasks | `--amend` hits the wrong commit or fails; a `revert` then drags foreign work along | one commit per task |
| Running two full suites in parallel | CPU oversubscription: test times bloat 3–5× (measured 14 → 56 ms), a reserve test tore a 10-s budget although it intrinsically costs ~563 ms — green with no meaning | **sequential** verification runs, even mixed ones (backend next to frontend) |
| Treating a locally red, CI-green test as a code defect | three evidenced cases in `portal.reisinger.pictures` — environment, not defect (`Storage::fake` path, `E2E_CHECKOUT_LIMIT`, shard load) | check the environment first; don't invent a second hypothesis to fit the first |
| `pnpm add` / dependency change without asking back | changes lockfile and CI time without commission | ask back, as in `angular-material-extended/AGENTS.md` §19 |
| Docs-only commit in a repo without `paths-ignore` | the full pipeline starts for one sentence: in one measured case 11 jobs incl. 6 Playwright shards | see the `github-ci-filters` skill |
| Clearing a dirty tree on your own authority | `git stash --autostash` or a blind `git pull` take away work that belongs to nobody anymore | stop and ask whose work it is |
