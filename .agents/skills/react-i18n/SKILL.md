---
name: React i18n
description: German-UI string internationalization for React+Vite with Lingui (macros, extract/compile gate, no module-scope t). TRIGGER on i18n/l10n/translation requests, "im Hintergrund ausführen" UI strings, untranslated text findings, or when a new React project needs UI-string setup.
---

# React i18n — Lingui UI strings (UI German, code English)

Standard: UI strings German, code and docs English. Source of truth is the
pattern proven in `portal.reisinger.pictures/frontend` (single locale `de`,
compiled `.po` catalog, build-time gate). See `references/lingui-setup.md`
for copyable config.

## The pattern (Lingui v5/v6)

- Macros in components: `<Trans>` for JSX, `t` inside render/function bodies.
- Catalog: `lingui.config.ts` with `locales: ["de"]`, `sourceLocale: "de"`,
  `catalogs: [{ path: "<rootDir>/locale/{locale}/messages", include: ["src"] }]`,
  `format-po` with `lineNumbers: false`.
- Provider (`src/logic/I18nProvider.tsx`): import compiled `messages` from
  `locale/de/messages.po`, `i18n.load("de", messages)`, `i18n.activate("de")`,
  wrap app in `<I18nProvider>`. It MUST be the first import in `main.tsx`
  (before the shell) — otherwise the production bundle evaluates shell chunks
  before activation and crashes.
- Vite: `@lingui/vite-plugin` plus Babel presets
  `[reactCompilerPreset(), linguiTransformerBabelPreset()]` — order matters,
  Babel runs presets in reverse so Lingui expands macros before the compiler.
- Scripts: `lingui:extract`, `lingui:compile`, and a `check-i18n` gate wired
  into `prebuild` (extract → compare msgids vs compiled values → fail on
  stale catalog or raw unwrapped strings).

## Strict rules

- NEVER call `t` at module scope (schema factories instead — call inside the
  component body). Production-only crash, dev stays green.
- No `any` / `@ts-ignore` / `eslint-disable`; `eslint-plugin-lingui` on.
- Verify with `pnpm build` + `pnpm preview` (dev hides the crash).
- Background-phrased strings ("im Hintergrund ausführen") are UI strings too:
  they go through the same macro + extract + compile flow, never hardcoded.

## Other frameworks

Lingui is React-first. For non-React work, keep the invariant (message IDs
extracted from source, compiled catalog, build gate failing on stale/missing
entries) and use the framework's standard catalog tool — do not port Lingui
macros outside React.
