# Adapters

The UI-review core in `../../SKILL.md` is stack-neutral; capture mechanics live
in these adapters. Select one from the project's existing configuration or by
auto-detection — there is no mandatory manifest field for it.

| Adapter | Use for | Entry point |
|---|---|---|
| `playwright/` | Web apps | `playwright/harness.md` + `playwright/templates/` |
| `rune/` | Rune / native Rust UIs | `rune/harness.md` |

Rune: real production view with synthetic data — its fixtures render the shipped view; the live screenshot is supplementary.

Shared, stack-neutral references stay one level up: `../ui-review-checklist.md`
and `../findings-report.md`.
