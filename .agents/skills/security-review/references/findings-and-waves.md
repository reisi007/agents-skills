# Findings and waves — severity, the gate, the loop, the report

The finding list is an intermediate product. What ships is the **closed, pinned
set**: every finding either fixed and pinned by a test, or carried as a named open
decision. This file defines how a finding is graded, how a phantom is caught, how
the work is cut into waves, and what the report must contain.

## Severity — reach × impact

Severity is a **product of two measured things**, not a mood. Grade the reach
(what can get here) and the impact (what a caller gets), then read the table.

| | Low impact | High impact |
|---|---|---|
| **Public reach** (no auth) | `medium` | `critical` |
| **Authenticated reach** (any role) | `low` | `high` |
| **Wrong-tenant / wrong-role reach** | `high` | `critical` |

- **Consumers set the impact.** An anonymous endpoint that returns a price list a
  live client renders is `high`; the same shape returning a constant is `low`.
- A word is not a severity: "public", "leak", "bypass" do not raise a grade. The
  reach and the impact do.
- **`critical` is reserved for** public reach *and* high impact — a secret, a
  write path, or another tenant's data, reachable without auth.

## Classes

| Class | Meaning | Enters a wave? |
|---|---|---|
| `BELEGT` | measured against the framework/config/a live request | yes |
| `HEURISTIK` | pattern-based; population right, individual case may be wrong | only after the gate confirms the case |
| `AKZEPTIERT` | a real defect the owner chose to carry | no — it becomes a named open decision |
| `ZURÜCKGENOMMEN` | failed the gate; published with its cause | no |

## The false-positive gate (Stage 3) — before the first wave

Every finding answers these before it is allowed into a wave:

1. **Does the criterion apply here?** (A "no auth" rule on an endpoint that is
   *supposed* to be public is not a finding.)
2. **Was the field measured, or guessed from a name?** A controller named
   `PublicController` proves nothing; the middleware list does.
3. **Is correct behaviour reported as a defect?** Deliberately public endpoints,
   token-credential flows (an endpoint that *issues* the credential is public by
   design), and signature-checked webhooks are correct — not findings.
4. **Is the evidence only your own input echoed back?** A 200 you got by sending a
   crafted request is evidence only if the request itself is legitimate.
5. **Does the population support the claim?** "3 routes lack auth" needs the total.

A failed finding is **retracted openly** (`ZURÜCKGENOMMEN`) with the cause, or
**replaced by a real finding**. Never deleted quietly — a reader who sees only the
final list reproduces the same phantom, and a wave spends itself on it.

## Wave planning

- **Group by mechanism, not by file.** Four controllers leaking through the same
  missing scope is *one* wave. Two unrelated defects that happen to touch one file
  are *two*.
- **Order:** severity first (`critical` → `high` → `medium` → `low`), then
  **smallest blast radius**. A one-line config fix (`'serve' => false`) ships before
  a route refactor, even at the same severity.
- **A wave is one commit** and one independently verified round. If a wave's diff
  cannot be described in one sentence, it is two waves.
- **Report-only is a decision, not a default.** `AKZEPTIERT` needs the owner's
  reason and a register entry; otherwise it becomes a named follow-up task. "Left
  it" is neither.

## The per-wave loop

Same flow as `build-verify`, applied per wave:

1. **Delegate** the wave to an implementer with the finding, the target files and
   the acceptance criteria (the tests below).
2. **Verify independently** — a different subagent, fresh context. It checks the
   substance: does the diff close *this* finding, does it move another one, is the
   tree green.
3. **On a redo the verifier reports `fixed` / `open` / `new`** per finding. A
   finding that is "fixed" but reappears through another path is **new**, not
   closed.
4. **Commit one per wave** — Conventional Commits, `Verify:` footer as in
   `build-verify`.
5. **Push and watch CI** as in `build-verify` rule 7 — unless the owner asked for
   manual verification, in which case do not push. A push never implies a deploy.

### Tests every wave carries

- **Anonymous access is refused** where the finding was "no auth": assert `401`
  (unauthenticated) and `403` (wrong role) — the two are different answers.
- **A minimised public endpoint returns exactly its fields** — assert the key set
  with `array_keys`, not `assertJsonStructure` (which tolerates an extra key), plus
  `assertJsonMissingPath` for each parameter that must **not** be there.
- **A removed route is gone** — `404`, or a route-list count of `0` for the URI.
- **The wrong tenant gets nothing** — a second identity requests the first's id.

## Pin it (Stage 6)

Closing a finding needs **both**, always:

- a **test that turns red on regression** (the assertions above), and
- an entry in the repo's **security/risk register** (name the guard, the file, the
  reason it exists).

A closed finding with only one of the two is a fix the next refactor may undo.

## The report contract (Stage 7)

Short, and every line evidence-based:

| Section | Must contain |
|---|---|
| What was open | each finding with the command that showed it **and** the population (`N routes, M without auth`) |
| Consumers | who calls the surface — authenticated vs. genuinely public, and where the caller lives |
| What changed | per wave, one line each, with the commit |
| Tests | which test pins which finding |
| Gates | green gates listed; a **blocked** gate quoted with its blocker output — never called green |
| Remaining | open decisions (`AKZEPTIERT`) and follow-up tasks |

Never print a secret in the report — the key name and its path, not the value.
