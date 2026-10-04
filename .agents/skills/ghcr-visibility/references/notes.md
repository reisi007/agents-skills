# GHCR Visibility — evidence and sources

Loaded only when someone asks for the **why** or the **evidence**. The procedure
itself is in [`../SKILL.md`](../SKILL.md).

## Sources

| Source | What it evidences |
|---|---|
| [GitHub — container jobs](https://docs.github.com/en/actions/using-jobs/running-jobs-in-a-container) | `container:` at job level is pulled by the runner **before** the first step, anonymously, without a `packages` scope — the flow `AGENTS.todo.md:156` describes as the impossible in-job login |

Everything else in `SKILL.md` is read from the `portal.reisinger.pictures`
reference repo, not measured from here. All paths relative to that repo root.

## Evidence `path:line`

| Statement in `SKILL.md` | Evidence |
|---|---|
| Anonymous pull, least privilege | `.github/workflows/ci.yml:18-25` |
| GHCR private → `unauthorized`, exit 125, all jobs | `AGENTS.todo.md:66` |
| `PATCH` returns 404, `GET` returns the package | `AGENTS.todo.md:151` |
| Measurement: abort after seconds, steps missing | `AGENTS.todo.md:155` |
| Why a login step comes too late | `AGENTS.todo.md:156` |
| Fork gate | `.github/workflows/ci.yml:233` |
| Fork PR and `packages` scope | `.github/workflows/ci.yml:467-471` |

## Deliberately open

- **How the manual image digest is maintained** (portal-side practice,
  `ci.yml:242`): no flow replacing it after a rebuild is described in any file
  read. Do not invent it; ask the project.
