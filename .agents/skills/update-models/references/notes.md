# Models — notes (why the rules exist)

Justifications, retired rules, and dated snapshots. Obligations live in
`SKILL.md`; nothing here is needed to run the skill. Anything naming a concrete
model, price, or tracker state is a snapshot — re-check the trackers (see
`data-sources.md`) before citing it.

## Why vision is non-negotiable

The whole agent setup assumes the configured model reads images itself: it reads
screenshots, EXIF-relevant details, and image categories directly. A text-only
model silently breaks that assumption, which is why price, context window, and
reasoning tier do not compensate.

## Retired — `opencode-go-first` (until 2026-09-26)

The old rule was "the `opencode-go/` twin always wins, because the subscription
is ZDR". It is **retired**. Do not reinstate it, and do not treat a configured
`opencode/<slug>` as an error. If a future conversation quotes ZDR as the
reason for a namespace move, that reasoning is stale. The rule that followed it,
`opencode-free-tier` (free tier only, 2026-10-02 until 2026-10-16), is retired as
well — and so is `opencode-go-mixed` (2026-10-16..2026-10-18), which split the roles
across three `opencode-go/` models. **Retired same-day (2026-10-18): the single-root
phase** — briefly the config carried only the root `model` (per-role models deleted,
`vision-agents` skill removed); per-role models are configured again. The **current**
rule is `opencode-go-only` (see `model-preferences.md`): per-role models on
`opencode-go/` for `plan`/`general`/`build`/`explore`, with the root `model` among the
configured models — no `opencode/` ids.
The standing justification while the free rules applied was: one model family,
everything free, no namespace juggling — not rename durability, not ZDR.

## Tracker privacy data is known-wrong (caveat set 2026-09-26)

The trackers' `privacy` block (`privacy.training`, `privacy.retentionDays`)
displays models as non-ZDR while the data is being corrected upstream. A
`training: true` flag is therefore not a usable reason to move a role or to
surface a candidate. `model-preferences.md` carries the matching
`privacyDataCaveat: 2026-09-26` entry; drop both once the data is fixed. The
only privacy signal that may still drive a decision is `privacy.validUntil`
(promo/expiry dates), double-checked.

## Signals and examples

- **Successor pair.** The strongest UPDATE signal is a changelog
  `model_removed` (old version) + `model_added` (new version) pair for the same
  family — that *is* the successor. Version tokens live in `name`
  (e.g. `<Family>-<oldver>` → `<Family>-<newver>`).
- **Usage drift.** A `usage_changed` increase (e.g. `15→60`, `60→480`) lowers
  the effective price — a good KEEP reason. A price increase means checking
  siblings for a cheaper alternative.
- **Staleness.** A role whose `// updated:` comment predates the latest
  relevant changelog entry is stale — call it out.

## Reasoning variants — history (do not re-apply)

`variant` is its own `AgentConfig` field, a sibling of `model` — **never** a
`#max` suffix on the model string. `"opencode-go/space-bunny-free#max"` is the
syntax for the *per-call* `model` override of a `subagent` tool call, not a
config field; in `opencode.jsonc` it is a model id that does not exist, so it
silently resolves to nothing. Proven against the SDK type: `AgentConfig` has
`variant?: string` on its own line (`@opencode-ai/sdk` `types.gen.d.ts`).
Not every model has variants — check the `models` tool (`query` +
`all: true`) rather than the shell, since `opencode models` prints flat ids
with no variants array. Measured snapshot: one free model advertised
`[low, medium, high, xhigh, max]` (all `$0`) while another advertised `[]`,
i.e. no variants at all. They work; they are simply not wanted.

## Dated config snapshot (2026-10-02, do not treat as current)

Every role sat on the free tier: one model family everywhere except `document`,
which held the `pdf` exception on a PDF-capable free model. Re-derive the
current state from `opencode.jsonc` and the trackers on every run.
