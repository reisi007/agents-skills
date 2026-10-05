# Lingui setup reference (ported from portal.reisinger.pictures/frontend)

Proven versions: `@lingui/core`, `@lingui/react`, `@lingui/cli`,
`@lingui/vite-plugin`, `@lingui/babel-plugin-lingui-macro`,
`@lingui/format-po`, `eslint-plugin-lingui` (all `^6.6.0` / `^0.14.0`).

## 1. `lingui.config.ts` (repo root of the frontend)

```ts
import type { LinguiConfig } from "@lingui/conf"
import { formatter } from "@lingui/format-po"

const config: LinguiConfig = {
  locales: ["de"],
  sourceLocale: "de",
  catalogs: [{ path: "<rootDir>/locale/{locale}/messages", include: ["src"] }],
  format: formatter({ lineNumbers: false }),
}

export default config
```

## 2. `src/logic/I18nProvider.tsx`

```tsx
import { i18n } from "@lingui/core"
import { I18nProvider as LinguiI18nProvider } from "@lingui/react"
import { messages } from "../../locale/de/messages.po"

i18n.load("de", messages)
i18n.activate("de")

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <LinguiI18nProvider i18n={i18n}>{children}</LinguiI18nProvider>
}
```

## 3. `src/main.tsx` — first import

```tsx
// MUST be the first import: activates the locale before the shell evaluates.
import "./logic/I18nProvider"
```

## 4. `vite.config.ts` — plugin + preset order

```ts
import babel from "@rolldown/plugin-babel"
import lingui, { linguiTransformerBabelPreset } from "@lingui/vite-plugin"

plugins: [
  react(),
  tailwindcss(),
  lingui(),
  babel({ presets: [reactCompilerPreset(), linguiTransformerBabelPreset()] }),
]
```

Babel runs presets in reverse: Lingui expands macros before the React Compiler.

## 5. `package.json` scripts + prebuild gate

```json
{
  "scripts": {
    "prebuild": "tsc -b && node scripts/check-i18n.mjs",
    "lingui:extract": "lingui extract",
    "lingui:compile": "lingui compile",
    "check:i18n": "node scripts/check-i18n.mjs"
  }
}
```

`scripts/check-i18n.mjs` (canonical copy in the portal repo): runs
`lingui extract`, collects msgids from `locale/de/messages.po`, collects
compiled values from `locale/de/messages.js`, fails when an extracted msgid
is missing from the compiled catalog (stale catalog would ship message IDs
instead of German text). A second AST pass reports raw JSX text/attributes
and literals handed to toast/confirm sinks — all fail, all must be wrapped
in `t` or `<Trans>`.

## 6. Component usage

```tsx
import { Trans } from "@lingui/macro"
import { useLingui } from "@lingui/react"

// JSX:
<p><Trans>Im Hintergrund ausführen</Trans></p>

// Imperative (inside body, NEVER module scope):
const { t } = useLingui()
const label = t`Im Hintergrund ausführen`

// Schema with translated messages: factory called in the component body.
const createSchema = () => z.object({ name: z.string().min(1, t`Name erforderlich`) })
```

## 7. Verification

`pnpm lint:fix && pnpm build`, then `pnpm preview` and check the console
for Lingui locale errors. `pnpm test` / E2E as usual.
