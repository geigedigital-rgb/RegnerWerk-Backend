# ADR 005 — Service cases

Status: Accepted  
Date: 2026-08-12

## Context

TZ §7.7 / Stage 3 requires service cases separate from sales pipeline and Sofort projects.

## Decision

- Table `service_cases` with TZ statuses and types
- Auto `safety_flags` + urgency bump for Rohrbruch/Wasserschaden text
- Create manually or from lead (`POST /api/crm/leads/[id]/service`)
- Case numbers `SC-YYYY-NNNN`

## Consequences

- UI `/crm/service` and `/crm/service/[id]`
- Overview shows open + urgent service counts
- Irrigation system passport link deferred (column reserved)
