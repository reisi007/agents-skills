## Verification evidence
<!-- git-issue-agent:evidence head=<40-char-head-sha> issue=<n> pr=<n> commit=<40-char-evidence-sha> -->

**Scenario:** <one sentence, from the issue's reproduction/acceptance>
**Reproduction:** `<exact command or click steps>`
**Environment:** <OS, browser, base URL, base commit / head commit>

| State | Screenshot | Video | Log |
|---|---|---|---|
| Before | ![before](<raw-url-before.png>) | [video](<raw-url-before.webm>) | [before.log](<raw-url-before.log>) |
| After  | ![after](<raw-url-after.png>)  | [video](<raw-url-after.webm>)  | [after.log](<raw-url-after.log>) |

**Result:** before showed <bug/absence>; after shows <fix/feature>.
**Acceptance checked:**
- [ ] <acceptance 1>
- [ ] <acceptance 2>

**Gates:** `<build>` / `<test>` / `<lint>` — all green.

<!-- The exact head, issue, PR and evidence commit are checked by merge. -->

<!--
Rules: same scenario, viewport and fixtures in both runs; the before run must
show the bug or the absence; no secrets or customer data. Non-UI projects use
the command transcripts and test exit codes instead of screenshots. This comment
must exist before `merge`; the evidence commit must contain a matching manifest.
-->
