---
name: SaaS
description: TRIGGER when scaffolding or extending a SaaS app — auth, multi-tenancy, billing/subscriptions, environments, or SaaS project layout. Reference for SaaS bootstrap checklist and conventions.
---

# SaaS — bootstrap & conventions

Opinionated checklist for starting or reviewing a SaaS project. Keeps every
SaaS build consistent: tenant isolation first, billing second, features last.

## Bootstrap checklist

1. **Tenancy model** — decide `single-DB + tenant_id` vs. `DB-per-tenant` up
   front. Default: single DB with `tenant_id` on every row + DB-level RLS /
   scoped queries. Record the choice in `AGENTS.md`.
2. **Auth** — email + OAuth (Google/GitHub). Sessions with short-lived access
   tokens; per-tenant roles (`owner`, `admin`, `member`). Never trust
   client-supplied `tenant_id` — derive it from the session.
3. **Billing** — Stripe (or equivalent) subscriptions: `trial → active →
   past_due → canceled`. Webhooks must be idempotent; gate features by
   `plan`, not by UI hiding alone.
4. **Environments** — `dev` / `staging` / `prod` with separate secrets.
   No production data in dev. Migrations run forward-only, one path.
5. **Observability** — structured logs with `tenant_id`, error tracking,
   and a `/healthz` endpoint from day one.

## Project layout

```
src/
├── tenants/       ← tenant scoping, middleware, RLS helpers
├── auth/          ← login, session, roles
├── billing/       ← plans, subscriptions, webhooks
├── features/      ← product code (always tenant-scoped)
└── admin/         ← cross-tenant ops (restricted to staff)
```

## Rules

- Every query filters by tenant. Add a lint/test that fails on unscoped
  access to tenant tables.
- Every mutating billing webhook is idempotent (event-ID dedupe table).
- PII stays out of logs. Secrets come from env, never from code.
- Feature flags are per-tenant, not global, where plans differ.

## Reference files

- None yet — add `references/` snippets (tenancy middleware, webhook
  handler, plan matrix) as they stabilize across projects.
