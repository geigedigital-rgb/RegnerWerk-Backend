# ADR 001 — Admin workspaces

Status: Accepted  
Date: 2026-08-12

## Context

The admin app previously had a flat top nav: Produkte + Projekte. The CRM+AI TZ requires two visually separated workspaces (CRM and AI Center) plus existing catalog/planner tools.

## Decision

Four workspaces with a shared top shell and **separate sidebars**:

1. **Produkte** — catalog JSON editors (`/produkte`)
2. **Projekte** — Sofort configurator submissions (`/projekte`, Supabase table `projects`)
3. **CRM** — customers, leads, pipeline, montage projects (`/crm/*`)
4. **KI-Assistent** — voice ops and AI config (`/ai/*`)

Naming:

- UI label **Sofort-Projekte** for configurator saves (avoids confusion with CRM **Montageprojekte**)
- Existing Supabase table `projects` is **not** renamed in this phase

## Consequences

- Route groups under `app/(produkte|projekte|crm|ai)/`
- Redirects from `/products` and `/projects`
- CRM and most AI pages are placeholders until data foundation (TZ Phase 1+)
