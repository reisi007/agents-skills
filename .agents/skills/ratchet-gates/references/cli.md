# The `ratchet` CLI — the tool behind the gates

`ratchet` implements the mechanic of this skill: the baseline, the direction,
the monotonicity, the reporting. The project owns the counting; the engine
owns the gate. The manual is the README of
[all-the-rest/ratchet-cli](https://github.com/all-the-rest/ratchet-cli)
(Apache-2.0) — this file is the map from the skill's concepts to the commands.

## Which command for which job

| Command | What it does | When a person reaches for it |
|---|---|---|
| `ratchet check` | runs every gate — the rules and the drift gates | the commit-time gate; the command CI runs |
| `ratchet count` | prints the current count per rule, without a comparison | "how many are there now?" — while writing the rule, or to see the debt |
| `ratchet baseline init` | writes the current count as the baseline of every rule that has none | introducing a rule — the first time, never by hand afterwards |
| `ratchet baseline update` | moves the baseline towards the count — **only** in the allowed direction | the paydown, after the debt was fixed |
| `ratchet baseline raise` | moves one baseline **against** its direction, with a reason | the deliberate exception: a new dependency, a written-off debt |
| `ratchet baseline path` | prints the repository-relative path of the baseline file | a script outside the binary needs the path — it must not resolve it itself |
| `ratchet drift` | runs the drift gates (the generated files) and nothing else | "is the committed artifact in sync?" — after a generator changed |
| `ratchet report` | renders the run into a Markdown report | the derived document the repository publishes |
| `ratchet verify` | runs the pre-release checks against their committed snapshots | the release pipeline — a benchmark is a measurement, not a defect class |
| `ratchet init` | writes a starter config when there is none | the first minute in a new repository |
| `ratchet update` | replaces the binary with the newest release, checksum verified | a new version exists |

The options — `--tier`, `--rule`, `--fix`, `--ignore`, `--format` — are in the
README; they are not repeated here, so that the two cannot drift.

## The gate header, in the tool's words

The header the skill asks for is a rule in `ratchet.config.jsonc`:

| Field | The skill's term |
|---|---|
| `class` | the defect class the rule counts |
| `incident` | the incident that motivated it — a prevention rule says so plainly ("prevention: no instance in this project yet") |
| `unit` | what one count unit is |
| `direction` | `ceiling` (count ≤ baseline) or `floor` (count ≥ baseline) |
| `tier` | `fast` (default) or `slow` — the two tiers of the skill |
| `count` | how the number is produced (below) |
| `files` | the path scope of the rule; without it the rule always runs |
| `exclude` | glob patterns removed from the counted **items** — path-shaped exemptions |
| `description` | free text |

An empty `class`, `incident` or `unit` is a configuration error — an empty
string is a missing value that passes the type check.

## The three counter forms

The project owns the counting, the engine owns the mechanic:

| Form | What the project owns |
|---|---|
| `command` | an argv — no shell — whose stdout is parsed: an integer, a list of items, or JSON (`count`, `items`) |
| `file` | a JSON file, optionally with a dotted `path` into it; `generate` + `output_arg` regenerate it into a temporary path first, so the tree is never written |
| `registry` | a findings registry (`ratchet.findings.json`), filtered by `severities` and `statuses` |

A counter that fails, prints garbage or returns a negative number is a
counter error — a gate that cannot be measured is red, not skipped.

## The direction, the baseline, the raise

The mechanic itself — ceiling vs floor, the monotonicity, the machine-written
baseline — is the subject of
[`ratchet-baselines.md`](ratchet-baselines.md). The tool adds two things:

- the **baseline file** is `ratchet.baseline.json` next to the config, unless
  the config names another path; it is sorted by rule id — a stable diff;
- the **raise** is the one move against the direction:
  `ratchet baseline raise --rule <id> --value <n> --reason "<text>"`. The reason
  is required and travels with the record, so the diff on the baseline file
  carries it; a raise without one is refused like any other forbidden move.

## The exit codes

| Code | Meaning |
|---|---|
| `0` | green |
| `1` | at least one gate failed |
| `2` | operational error: invalid config, missing config, crashed counter, unreadable file, unknown command or path |

`ratchet report` is the exception: it exits `0` whenever it produced a report —
the verdict is in the content, `ratchet check` on the same tree exits `1`.

## The three traps

**1. A stale baseline is a failing gate, not a warning.** `baseline update`
moves only in the allowed direction and refuses the other. A baseline that
moved against its direction without a reason is reported as `baseline-raised`
or `baseline-lowered` — the invalid artifact — even when the count comparison
passed. The deliberate exception is `baseline raise`, with a reason.

**2. The report renders the rules, not the drift gates.** The report is
itself a generated file — a report holding the result of the comparison with
itself would be a regress. The drift verdict belongs to `check` and to the
diff the gate prints. The report renders a run; the report of a red run is
red.

**3. A source-level gate that must decide what is compiled needs a parser, not
a `grep`.** A text scan cannot decide which code is *compiled* — test modules,
`cfg` conditions, attributes, macros. A multi-line attribute swallows the rest
of the file and the gate reports green; a `#[test] fn` at file scope breaks
the scanner. A gate that can be defeated silently is worse than no gate. A
gate that only counts words does not need a parser — it only has to say that
it counts words.

## Install

**No tag was pushed yet** — there is no GitHub Release to download and no
release for the action to install. Until the first tag exists, build from
source.

- **Release asset** — a release publishes **two** assets per platform: the
  archive (`ratchet-<version>-<os>-<arch>.tar.gz`, `.zip` on windows) for the
  manual install, and the raw binary (`ratchet-<version>-<os>-<arch>`, `.exe`
  on windows) for the self-update and the action. The platforms are
  `linux-x86_64`, `linux-aarch64`, `macos-x86_64`, `macos-aarch64` and
  `windows-x86_64`; `checksums.txt` covers every asset. Verify the checksum,
  then put the binary on the `PATH`.
- **From source** — `cargo install --path .` in a clone of the repository.
- **GitHub Action** — `uses: all-the-rest/ratchet-cli@v1` installs the binary
  and verifies its SHA-256 against the release's `checksums.txt`. `mode:
  validate` runs `ratchet check` and fails the job on a failing gate; `mode:
  update` runs `ratchet baseline update` and **commits** the changed
  baseline. The update mode is opt-in — a bot that moves the baseline on
  every push defeats the monotonicity check — and needs `contents: write`
  and a `baseline-reason`.

## The vocabulary and the gaps

The levels and the statuses are defined once, in
[`vocabulary.md`](vocabulary.md) — the registry counter enforces the same
lists in code. The blind spots of the tool itself are named in the README of
its repository, in the section that gates the tool against itself — not
here.
