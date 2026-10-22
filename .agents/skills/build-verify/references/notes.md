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
  otherwise later no one can tell whether a run happened at all. What a number
  in the message claims, and how that claim gets its frame, is its own
  question — "Every number names what it measures" below.
- **One commit per task** — the reason lives under "Amend or new commit?"
  below. Committing two parallel tasks as one wave hits the
  wrong commit or fails; one task waiting for all others blocks the others.
- **In a shared tree the paths are the mechanism, not a style.** A bare
  `git commit` takes the **whole index** — and in a tree with parallel
  sessions the index holds another session's staged work. Measured 2026-10-21
  on the committed state of `LuminaRust` (`git show --numstat`, scope: the
  file `AGENTS.skills.md`): the commit `a094cb8` (subject "docs(plan): falsche
  CI-Praemisse im UX-Gap-Task korrigiert") carries a `skills-marker` advance
  of **another** session — **+147/−151** lines (298 changed lines) — and
  `5e35b50` (subject "chore(scripts): Werkzeug zum Erneut-Erzeugen der
  generierten Doku-Bloecke") carries the next advance in the same file,
  **+82/−29** (111 changed lines); both under a foreign subject and with the
  footer "Verify: none (…, 0 Runden)". Content correct, history wrong.
  `git commit -- <path>` takes only the named paths — their working-tree
  content, the index ignored for them; `git add -A` is the same accident with
  a wider radius. **Leave nothing staged**: staged and left lying is an
  invitation to the next commit, and the next commit need not be yours.
  **The duty is the committer's, not the neighbour's** — nobody can know who
  commits next, so nobody hands over a loaded index.
- **`--rebase` instead of merge**, because `main` is consolidated onto — no
  per-task branches.
- **Verification runs sequential, never parallel** (Rule 8). CPU oversubscription
  produces a green light with no meaning.

## Every number names what it measures

The `Verify:` footer is a claim about the commit, and so is every number in
the message that claims something about the commit — a claim needs its frame
of reference: **which state, which scope** (Rule 5).

- **The failure is a number without a frame.** Measured, not hypothetical: in
  one working session across two projects it appeared as a commit count
  filtered to one path presented as the size of the range, a gate stage
  reported green from the dirty checkout where the committed state had fewer
  stages, a file line range taken from the dirty checkout of a parallel session
  where the committed state had different lines, and an open-task count from
  the dirty checkout where the committed state had fewer tasks. In every case
  the number was right about the place it was measured in and wrong as a
  statement about the commit. The target form shows the fix: the checkout
  figure and the committed figure side by side, each labelled — the figure was
  right, and the claim became true by naming the frame. The figures
  themselves — project, commit, both states — are in the commit message that
  introduced this section.
- **Two trees, reported separately.** A number measured in the dirty checkout
  never becomes a statement about the commit — both states are then reported
  separately, each carrying the state it belongs to.
- **Naming the frame needs no fixed vocabulary.** Repos that never say
  "working tree" still name it concretely — by the commit that was measured
  (`commit <sha>`), by range and filter (`<from>..<to>`, only the `<path>`
  paths), by the scope of a gate (`stage fast`), by the scope of a task list
  (all tasks vs. one directory), or in the repo's own words ("uncommitted
  changes in the checkout"). The frame names what the number is about: the
  scope it covers and — when the claim is about the commit — the state it was
  measured in. A filtered count presented as a range size has no frame at
  all; the filter is part of the frame.
- **The trigger is not a dirty tree.** A dirty tree is the normal state of a
  repo with a parallel session; it is not a reason to distrust a number. The
  trigger is a number that *claims something about the commit* — and the
  claim is checkable: measure the committed state and compare.

**The method — the committed state is measured, not checked out.**

```sh
tmp=$(mktemp -d)
git archive <sha> | tar -x -C "$tmp"   # exports the commit's tree; touches neither index nor checkout
( cd "$tmp" && <the gate> )             # the gate runs against the committed state
```

`git archive` reads the object store and writes a copy: index and working
tree stay untouched, so a parallel session's uncommitted work survives. Rule 3
of the rule file forbids `git checkout` / `git restore` / `git reset` for
exactly that reason; `git archive` is the way to measure the committed state
without taking that risk. The gate runs twice then — once in the checkout, once
in the exported tree — and the footer names both results, each with its state.

**Who checks the frame.** The footer is written after the verify run, and the
verifier never sees the message — so the frame is the author's duty at write
time, not a check that happens later. The cheap test before writing it: does
the figure hold in the exported tree as well?

## Why the milestone review is optional and not per-feature

Per-feature verify exists because a fresh context catches what the author's
context cannot. Coherence across features is a different failure class: single
tasks each pass their own gates while the accumulated set contradicts itself —
a flag renamed in one feature still read under its old name in another, an
end-to-end path no single task walked, a regression only visible against the
feature before. No per-round check sees that by construction, and running it per
feature would pay a whole-loop cost for a signal only the set carries. Hence:
once at a release or every N features, as its own fresh session — per-feature
verify stays mandatory either way.

## Gates: why the verifier does not repeat them

A verify run checks **the thing, not the gates**. Running the mechanical gates a
second time buys no second opinion:

- **They are deterministic machinery.** `ruff` / `pytest` return what they
  already returned; a second run reproduces the first. The verifier's value lies
  where a gate is blind — does the diff fulfil the commission, do the invariants
  hold, does the storage/cost math, how far does the blast radius reach.
- **CI is the better independent run.** Where the repo has CI, it runs the gates
  on the **pushed** artefact — a system independent of the implementing agent, on
  what actually persists. A verifier re-running locally is a weaker copy of
  that, paid for out of the context it would otherwise spend on the substance.

Two failure shapes the default must not swallow:

- **Circularity — the change touches the gates.** Whoever edits the tests,
  `conftest`, or the lint/format config and then reports "green" has checked
  their own edit with itself. That evidence is no evidence; the verifier runs the
  gate.
- **No CI, no push.** With no CI for the repo or artefact (or a change that is
  never pushed), the independent gate run does not exist at all — the verifier
  is the only one who can supply it.

The other two exceptions sharpen the same point: a report that does not cover
the changed surface (only the touched test files ran while the change sits in
shared code) buys a narrowed second run, and a report without quoted output is a
claim, not evidence — the verifier demands the output rather than standing in
for it. All four live with the contract in
[`verifier-prompt.md`](verifier-prompt.md).

## Kleinheits-Ausnahme

Not every change needs the loop: on a typo it costs two subagent rounds. The
orchestrator does trivia itself — the bar is deliberately set **wide** (see K1
in the rule file), because nobody independent re-reads trivia; K2 through
K4 carry the risk, not the size.

The four criteria live in `../../../rules/build-verify.md` — a project's `AGENTS.md`
points at it, but it is **not** delivered into a session by itself (no config
key delivers it) — here only their derivation, so the two don't drift apart.
"K1" through "K4" mean those four criteria in the rule file's order:

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
- **Pure plumbing is text — the reader test applies to the reader, not the
  mapping.** Mapping an existing key into env changes no behavior by itself;
  the behavior lives in the reader. If the reader predates the task and is
  untouched by it, the mapping carries no failure potential of its own.
  Measured 2026-10-07: a one-line `environment:` mapping for a key whose
  reader was live and unchanged — the line was trivially correct; the two
  real defects of that task sat in the accompanying prose, not the mapping.
- **Accompanying docs ride with the functional change.** Judging docs
  separately from the change they document double-counts the task against K1
  and pushes minis into the loop. The bar is the whole task under K1; K4
  catches self-standing rules for future work, not the change's own
  explanation. Stated tradeoff: prose defects can ship this way — mitigation
  is the orchestrator's self-check with machine proof (`config` render,
  `validate`, `grep`) before committing.
- **New files are in.** A new docs file is no code risk. **Deleted ones too —
  but only docs and pure text files;** a deleted file that contained logic is
  out. (K2 checks what is written, not what is deleted — hence the boundary
  lives here.)
- **"Tightened duty/threshold" is out, "rationale sentence" is in.** This is the
  sharpest open boundary of the whole exception and exactly the case that
  produces the silent failure: rephrasing a rule is harmless, tightening a duty
  is not.
- **The repo-specific amend rule is gone.** `agent-config` §6 used to document
  amend + `--force-with-lease` as `agents-skills`' own style; since 2026-10-10
  separate commits are the default there too (the owner's correction: an amended
  SHA breaks the `skills-marker` ranges other projects record). Amend is the
  flow's redo path (Rule 6), a fix to your own unpushed HEAD, and — since
  2026-10-21 — one exception for your own fresh pushed commit, under the
  conditions in [`amend.md`](amend.md). A repo's own branch policy can still
  forbid that exception: `agents-skills` does, for the reason above.
- **The test is not "is it easy" but "is it clearly under the bar."** Two rounds
  for a cheap task cost less than a feature with a silent defect.

| in | out |
|---|---|
| `docs(x): clarify flag name`, typo in `AGENTS.md`, port in `.env.example`, rationale sentence for an existing rule, new docs file, new role in `opencode.jsonc`, 4 language files at 20 lines each, mapping an existing key into env (reader unchanged and predating the task), docs accompanying the change while the whole task stays under K1 | more than 5 files or more than ~80 lines (add + del, whole task), logic, control flow, API/signature change, new dependency, build/test/schema change, new field in an application-code-read config, a reader changed or introduced by this task, anything touching permissions, plugins, `instructions`, or hooks, a self-standing behavioral rule beyond the change **or tightened duty/threshold** in `AGENTS.md` or a skill |

**Discarded alternatives** (deliberately not, see `~/.config/opencode/AGENTS.todo.md`
§Verworfen (Build-/Verify-Flow)): scrapping the exception — then every typo costs
two rounds; and keeping the exception with a still-mandatory verifier — that is
paid friction with no signal. Abolish independence and you abolish the loop.

## Amend or new commit?

Moved to [`amend.md`](amend.md): the amend-vs-new-commit decision table and the
reflog commands for the last round's delta. Rationale kept here: amend rewrites
`HEAD` only, never an earlier commit — so two parallel
tasks committed as one wave hit the wrong commit or fail, and one task waiting
for all others blocks the others. **The path-commit clause creates no amend
obligation**: it binds *how* a commit is made (only the named paths, nothing
left staged), not *when* one is made — rule 6's exception ([`amend.md`](amend.md),
your own fresh pushed commit under `--force-with-lease`) stands **beside** the
clause, not in it, and stays as it is.

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
| Verifier re-runs the full gate suite | reproduces a green that was already quoted; the context it spends is missing for the substance | trust the quoted green; re-run only under the four exceptions in [`verifier-prompt.md`](verifier-prompt.md) |
| First verify run without a mode flag | the verifier checks the tree as if after a fix and reports "fits" — with no reference to the findings | pass the `nach-verify:` flag on **every** run |
| `git checkout <file>` during mutation testing | destroys the implementer's uncommitted work; no way back exists then | commit beforehand (Step 3, commit), a copy, or a documented `git stash` |
| A number from the dirty checkout presented as a statement about the commit | the footer reports a gate state, a task count or a line range that the commit does not have; the reader cannot tell what was measured | name what the number measures; measure the committed state with `git archive <sha>` into a temp directory |
| `git add -A` in a shared tree | pulls in a **concurrently running** agent's work: evidenced by a commit with 14 files / 408 lines from `features/` that were not its own — content correct, message wrong, history misleading from then on | always explicit paths; `git show --stat` before the commit |
| A bare `git commit` in a shared tree | takes the **whole index**, so a staged file of another session rides along under your subject: measured 2026-10-21 on the committed state of `LuminaRust` — `a094cb8` and `5e35b50` each carry a foreign `skills-marker` advance in `AGENTS.skills.md` (298 and 111 changed lines, that file), content correct, history wrong | commit with `git commit -- <path>` (only the named paths) and leave nothing staged |
| Only committing on `APPROVED` | the work state between rounds exists only in the working tree; every abort loses it | commit after **every** verify run, verdict irrelevant |
| Amending although already pushed | `git push --force` on a read state overwrites foreign commits | `--force-with-lease`, and normally: don't amend in the first place — the one exception (your own fresh commit, nothing on top of it, replaced SHA disclosed) is in [`amend.md`](amend.md) |
| Commit from a wave of parallel tasks | `--amend` hits the wrong commit or fails; a `revert` then drags foreign work along | one commit per task |
| Running two full suites in parallel | CPU oversubscription: test times bloat 3–5× (measured 14 → 56 ms), a reserve test tore a 10-s budget although it intrinsically costs ~563 ms — green with no meaning | **sequential** verification runs, even mixed ones (backend next to frontend) |
| Treating a locally red, CI-green test as a code defect | three evidenced cases in `portal.reisinger.pictures` — environment, not defect (`Storage::fake` path, `E2E_CHECKOUT_LIMIT`, shard load) | check the environment first; don't invent a second hypothesis to fit the first |
| `pnpm add` / dependency change without asking back | changes lockfile and CI time without commission | ask back, as in `angular-material-extended/AGENTS.md` §19 |
| Docs-only commit in a repo without `paths-ignore` | the full pipeline starts for one sentence: in one measured case 11 jobs incl. 6 Playwright shards | see the `github-ci-filters` skill |
| Clearing a dirty tree on your own authority | `git stash --autostash` or a blind `git pull` take away work that belongs to nobody anymore | stop and ask whose work it is |
