# Evidence — a human must be able to compare before and after

The merge gate requires a human-verifiable before/after record from the same
scenario. The publisher binds an evidence manifest to the configured project,
issue, PR number and exact source head SHA; the PR comment carries that evidence
commit SHA in its machine marker.

There is no opt-out: if no artifact can be produced, the issue is blocked, not
merged on a promise. Artifacts must be non-empty under both `before/` and
`after/` directories.

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
2. rejects hidden/credential-like names, common key/token/password patterns in
   content, malformed common image/video formats, more than 50 MB per file and
   more than 100 MB total. There is no bypass flag,
3. verifies `origin` identifies the configured GitHub project, then pushes to
   that project's canonical HTTPS URL using the operator's normal Git credential
   setup. It creates a unique branch; it never force-pushes,
4. writes `manifest.json` containing the project, issue, PR, source head SHA and
   each artifact's Git blob SHA/size, then prints raw URLs pinned to the
   evidence **commit SHA** (GitHub: `raw.githubusercontent.com`;
   GitLab: `/-/raw/`), so a later branch refresh cannot alter a posted comment.

Private-project URLs need the viewer's host session; the owner can still see
them. If artifacts contain customer data, replace it with a fixture and redact
tokens **before** publishing. Pattern scanning is only a guardrail: binary
screenshots/video may visibly contain secrets or customer data and must be
inspected manually. Failed Git authentication is a hard error; this skill does
not read credentials from `gh` or configure Git auth.

## 5. PR comment template

`templates/verification-comment.md`:

```md
## Verification evidence
<!-- git-issue-agent:evidence head=<40-char-head-sha> issue=<n> pr=<n> commit=<40-char-evidence-sha> -->

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
- an evidence comment whose manifest does not match the PR's current head;
- credential-like content (publisher refuses common patterns) or private customer data;
- an artifact that does not show the issue's acceptance at all.

Insufficient evidence is `CHANGES REQUIRED`, not a merge.
