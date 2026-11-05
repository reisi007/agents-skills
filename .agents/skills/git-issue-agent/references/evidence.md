# Evidence — a human must be able to compare before and after

The merge gate is human-verifiable, not "the agent says it works". Every issue
gets one PR comment with **before** and **after** artifacts from the **same
scenario**, plus the marker `<!-- git-issue-agent:evidence -->`.

There is no opt-out: if no artifact can be produced, the issue is blocked, not
merged on a promise.

## 1. Choose the evidence class

| Repo surface | Before | After |
|---|---|---|
| Web UI / Playwright present | screenshot + video of the reproduction | screenshot + video of the fixed flow |
| CLI / library / service | `script` transcript + failing test output | transcript + passing test output |
| Docs / generated output | rendered page screenshot or diff | rendered page screenshot |

One scenario only: the issue's reproduction or acceptance. Do not invent a
second story that happens to pass.

## 2. UI — Playwright

Use the repo's existing spec if it covers the scenario. Otherwise copy
`templates/evidence.spec.ts` into a temporary spec, adapt the steps, and keep it
out of the PR unless the issue explicitly asks for an E2E test.

```sh
# terminal A (base worktree)
EVIDENCE_BASE_URL=http://127.0.0.1:3101 npx playwright test evidence.spec.ts \
  --project=chromium --reporter=list

# terminal B (issue worktree, different port)
EVIDENCE_BASE_URL=http://127.0.0.1:3102 npx playwright test evidence.spec.ts \
  --project=chromium --reporter=list
```

- Same viewport, same steps, same test data.
- Start the app in each worktree with the repo's documented dev command.
- `video: 'on'` and `screenshot: 'on'`; a failing "before" assertion still
  produces artifacts.
- Copy the artifacts into `<artifacts>/before/` and `<artifacts>/after/`.
- Run heavy browser/build work **one at a time** on this host.

The before run **must fail** (bug) or **must show the absence** (feature). An
unexpectedly passing before run means the issue is not reproducible: stop and
report it instead of fabricating evidence.

## 3. Non-UI — transcript and tests

```sh
script -qec "<exact repro command>" before.log
script -qec "<exact repro command>" after.log
```

Attach both logs plus the test command output and exit codes. Include the
command verbatim in the comment; a human must be able to rerun it. A test that
fails before and passes after is the strongest artifact for a bug.

## 4. Publish

```sh
node "$SKILL_DIR/scripts/agent.mjs" evidence <owner/repo> <issue> --dir /tmp/opencode/gia-<issue>/evidence
```

The CLI:

1. hashes the artifacts and builds an **orphan** commit (no worktree is touched),
2. refuses secret-like names (`.env`, keys, tokens — override only with
   `--allow-secret-like` after redaction), more than 50 MB per file and more
   than 100 MB in total,
3. force-pushes it to `agent-evidence-issue-<n>` (never merged),
4. asks the provider adapter for the raw URL of each file and prints them
   pinned to the evidence **commit SHA** (GitHub: `raw.githubusercontent.com`;
   GitLab: `/-/raw/`), so a later branch refresh cannot alter a posted comment.

Private-project URLs need the viewer's host session; the owner can still see
them. If the artifacts contain customer data, replace it with a fixture and
redact tokens **before** publishing.

## 5. PR comment template

`templates/verification-comment.md`:

```md
## Verification evidence
<!-- git-issue-agent:evidence -->

Scenario: <one sentence, from the issue>
Reproduction: `<exact command / steps>`
Environment: <OS, browser, base URL, commit>

| State | Screenshot | Video | Log |
|---|---|---|---|
| Before | ![before](<raw-url>) | [video](<raw-url>) | [before.log](<raw-url>) |
| After  | ![after](<raw-url>)  | [video](<raw-url>) | [after.log](<raw-url>) |

Result: before showed <bug/absence>; after shows <fix/feature>.
Acceptance checked: <bullet>
Gates: `<build>` / `<test>` / `<lint>` — all green.
```

A video cannot play inline in a comment on most Git hosts; the link is the
evidence and must be labelled. Screenshots inline where possible.

## 6. What makes evidence insufficient

- a screenshot without the reproduction steps or the commit/URL;
- "after" only, no baseline;
- different scenarios, data or viewport between before and after;
- a green test run with no failing baseline for a bug;
- secret-like files (the publisher refuses them) or private customer data;
- an artifact that does not show the issue's acceptance at all.

Insufficient evidence is `CHANGES REQUIRED`, not a merge.
