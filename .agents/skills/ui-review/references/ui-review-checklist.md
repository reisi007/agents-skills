# UI Review Checklist

Apply this checklist to every screenshot. Report findings per image, referencing
the file name. Keep it factual: name the element and the visual defect; propose
a concrete fix.

Before fixing a finding, confirm **which element actually renders it**. Similar
elements may be duplicated across routes or states, so search the source for the
relevant component or repeated element before editing. Fix **every** affected copy,
and prefer a shared component where that fits the project so the copies cannot
drift apart again.

## 1. Contrast & readability

- Text is readable against its background (no low-contrast gray-on-gray for body
  text; small/muted text especially).
- No text on busy/noisy backgrounds; badge/label colors keep sufficient contrast.
- Link color is distinguishable from body text.

## 2. Spacing & alignment

- Consistent spacing rhythm (gaps, paddings, margins) within and between sections.
- Elements align on a grid; no arbitrary offsets or ragged edges.
- In a flex row where one cell holds a label above a tall status block, check
  whether the action belongs on the label's line rather than vertically centred
  against the block. If the label reads as the row's title, a centred button may
  float against the status content; compare the action's baseline with the label.
- No cramped or overflowing content; card/table content has comfortable padding.
- Fixed/sticky elements do not overlap content.

## 3. States (empty / loading / error)

- Empty states render deliberately — a clear empty message, not a blank void or a
  leftover spinner.
- Loading states exist and look intentional (spinner alignment/placement).
- Error states are styled as alerts and readable.
- No "flash" artifacts that would confuse a reviewer.

## 4. Responsive behavior (desktop vs mobile)

- Desktop layout is airy; mobile layout uses the full width without horizontal
  scroll.
- Tables/grids degrade gracefully on mobile (wrap, stack, or scroll within a
  container — never clip).
- Header/nav/sidebar behavior on mobile is usable (menu not overflowing).
- Tap targets are large enough on mobile.

## 5. Hierarchy & typography

- One clear `h1` per page; section headings are visually distinct.
- Font sizes/weights express hierarchy; type scale is consistent.
- No orphan headings or oversized/undersized text.

## 6. Interactive states

- Primary actions are visually dominant; secondary actions are clearly secondary.
- Disabled buttons look disabled (not just dimmed text).
- Hover/focus affordances exist (focus ring visible).
- Buttons/links are labelled; icons alone are not (unless accompanied by an
  accessible name).

## 7. i18n correctness

- UI copy is in the active language (no untranslated or English strings leaking
  into a German UI and vice versa).
- No hard-coded user-visible strings that should be catalogued.
- Date/number formatting matches the locale.

## 8. Design system consistency

- Where the project has a design system, components use its established
  primitives (for example, buttons, cards, badges, alerts, tables, and menus)
  rather than one-off look-alikes.
- Where a theme palette exists, colors use its tokens rather than ad-hoc values.
- Consistent border radius, shadows, and hover states across components.

## 9. Layout bugs / overflow

- No horizontal overflow, clipped text, or content cut off at viewport edges.
- Long words/emails/URLs wrap or truncate instead of breaking the layout.
- Images scale correctly (no distortion); missing images hide gracefully.

## 10. Branding

- App branding, header, and footer are present and correct.
- No missing/duplicate logo or header on any state.
- Brand assets are not pixelated or stretched; fallback branding is coherent.

## 11. Automated contrast checks (when available)

The screenshot review catches contrast regressions by eye. If the project has
automated contrast tests, run them using the project's documented command and
evaluate failures against its accessibility criteria; do not assume a particular
framework, test location, or command. If there are no such tests, use the visual
checks above without treating a missing test suite as a defect.

- For projects with semantic theme colors, useful coverage checks the foreground
  and background pairs actually used by the UI (for example, body text, links,
  badges, and alerts) in each supported theme.
- Measure rendered colors when browser color functions, opacity, or translucent
  backgrounds affect the result; for translucent content, include the surface it
  is composited over.
- Apply the project's chosen contrast standard and acceptance criteria. When
  adding a semantic color or changing a theme token, rerun relevant checks for
  the affected combinations and supported themes.
