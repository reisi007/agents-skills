# Verifier prompt — contract and templates

Open when briefing the verifier (flow Step 2: the verify run).

## The contract

- The verifier is **never the implementer of the same task** — its fresh context
  is the whole point of the loop.
- It fixes nothing. It checks, measures, and reports findings.
- It never destroys uncommitted work: `git checkout`, `git restore`, and
  `git reset --hard` on paths with uncommitted changes are forbidden. Admissible
  only: the state was committed beforehand, work on a copy, or a deliberately
  documented `git stash` with `stash pop` at the end. A violation is reported
  immediately and completely — including which statement can no longer be made
  afterwards.
- Full run: diff review, all commands from the repo's `AGENTS.md`,
  architecture/security review; findings as `file:line` plus severity
  (`critical`/`high`/`medium`/`low`). `critical`/`high` block `APPROVED` and
  become their own fix tasks. A verdict without a complete findings report is
  not accepted.
- Every run is explicitly flagged. Without a reference to the previous round, a
  redo run cannot tell whether a finding was fixed or merely moved — so on
  `nach-verify: true` the verifier reports per prior-round finding: fixed,
  still open, or new, with the evidence for each, plus a check that no fix
  merely moved the finding.

## Template — first run (`nach-verify: false`)

```
Project: <path>   Task: <what>
nach-verify: false

Check: <commands from this repo's AGENTS.md>
Deliver: verdict APPROVED | CHANGES REQUIRED, findings with file:line + severity.
Assert nothing you cannot evidence.
```

## Template — redo run (`nach-verify: true`)

```
Project: <path>   Task: <what>
nach-verify: true
Previous round: <last verdict + finding list>

Check: <commands from this repo's AGENTS.md>
Deliver: verdict APPROVED | CHANGES REQUIRED, findings with file:line + severity,
plus one status per prior finding — fixed / open / new — with the evidence you
base it on, and a check that no fix merely moved the finding.
Assert nothing you cannot evidence.
```
