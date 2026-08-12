# ADR 009 — Rules & Stop Triggers

Status: Accepted  
Date: 2026-08-12

## Context

TZ §16 requires server-side stop/escalation rules that cannot be overridden by prompts alone.

## Decision

- Tables: `rule_definitions`, `rule_releases`
- Seed critical keyword rules (human request, water emergency, legal, privacy, complaint, …)
- Admin UI `/ai/regeln`: edit pattern/priority, phrase test, publish release
- Voice Gateway loads `/api/ai/rules/published` with local phrase fallback
- Critical rules cannot be disabled via API yet (Owner override later)

## Consequences

- Semantic match type deferred (keyword/regex only)
- Live definitions used if no release published
