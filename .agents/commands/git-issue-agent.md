---
description: Git Issue Agent — triage trusted issues, build one, publish SHA-bound evidence; auto-merge enabled repos when required CI and every safety gate pass (opt out with `auto_merge: false`; skill `git-issue-agent`)
---

Load the skill `git-issue-agent` with the `skill` tool (exact ID: `git-issue-agent`) and follow its instructions.

This workflow is headless: never use the `question` tool. Questions, blockers and results go to the issue tracker as comments.

Mode (default `run`): `run`, `setup`, `update`, `status`, `pause <project>`, `resume <project>`.

$ARGUMENTS
