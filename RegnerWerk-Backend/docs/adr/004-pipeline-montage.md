# ADR 004 — Pipeline & Montage projects

Status: Accepted  
Date: 2026-08-12

## Context

TZ Stage 3 requires opportunities with stage history and installation projects after won. Sofort configurator already uses `public.projects`.

## Decision

- Dictionary `pipeline_stages` with TZ codes (qualification … won/lost)
- `opportunities` + append-only `opportunity_stage_history`
- CRM installs live in `montage_projects` (not Sofort `projects`)
- Lead convert → opportunity; move to `won` creates montage project idempotently
- Lost requires `lossReason`; AI cannot call these endpoints without future auth/policy

## Consequences

- UI: `/crm/pipeline`, `/crm/pipeline/[id]`, `/crm/montageprojekte`
- Lead detail: «In Pipeline übernehmen»
- Auth still pending — endpoints are service-role only via admin
