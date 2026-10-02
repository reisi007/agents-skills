---
name: Node Dependency Policy
description: TRIGGER when a Node/pnpm project pins dependency versions (exact versions in package.json without ^/~ range, minimumReleaseAgeExclude entries in pnpm-workspace.yaml, a packageManager version pin), when a dependency update, security fix or audit finding is due, or when the user asks how dependencies should be managed. Reference for the no-pins rule: ranges in package.json, updates exclusively via pnpm into the lockfile, never as pins.
---

# Node Dependency Policy — keine Pins, Updates via pnpm ins Lockfile

**Regel:** Dependency-Versionen werden nirgends gepinnt. Updates landen
ausschließlich über pnpm im Lockfile (`pnpm-lock.yaml`), nie als feste
Versionen in Manifesto oder Workspace-Config.

## Verboten

- **Exakte Versionen in `package.json`** — jede Dependency (dependencies wie
  devDependencies) trägt einen Range (`^x.y.z`, Standard). Eine Version ohne
  `^`/`~` ist ein Pin und wird in einen Range umgewandelt, nicht „aktualisiert“.
- **`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`** — (war eine
  Supply-Chain-Policy, ist verworfen). Einträge ersatzlos streichen; ist die
  Liste danach leer, den ganzen Key entfernen.
- **`packageManager`-Pin in `package.json`** — kein `pnpm@x.y.z`-Eintrag. Es
  gilt die lokal installierte pnpm-Version (ggf. je Maschine verschieden);
  ein Pin bricht Setups mit anderer lokaler Version. Ausnahme CI: dort
  braucht `pnpm/action-setup` eine Version — sie steht als Major-Linie
  (`version: 11`) im Workflow-Input, nie als Exakt-Pin, nie in `package.json`.

## Updates (nur so)

- Security-Fixes: `pnpm audit --fix=update` (nicht `override` — das schreibt
  `pnpm.overrides`-Pins; `update` bleibt in den Ranges) — schreibt ins
  Lockfile, fasst `package.json` nicht an.
- Routine-Bumps: `pnpm update` (ggf. gezielt `pnpm update <pkg>`).
- Danach verifizieren: `pnpm install --frozen-lockfile` muss grün sein plus
  der projekteigene Check aus dessen `AGENTS.md` (mindestens Typecheck/Build).

## Beim Antreffen eines Pins

1. Pin entfernen (Range statt Exaktversion / Key bzw. Eintrag streichen).
2. `pnpm install` (Lockfile auflösen lassen).
3. Projekt-Check grün (Typecheck/Build).
4. Als `chore(deps)` committen — kein Feature, kein Fix.
