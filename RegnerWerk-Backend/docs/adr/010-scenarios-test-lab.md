# ADR 010 — Scenarios & Test Lab (text mode)

Status: Accepted  
Date: 2026-08-12

## Context

TZ §15/§18 require conversation scenarios and a regression Test Lab before production AI publish.

## Decision

- Tables: `scenario_definitions`, `scenario_releases`, `test_lab_cases`, `test_lab_runs`
- Seed all mandatory scenarios (§15.2) and critical text regression cases (§18.3 subset)
- UI `/ai/szenarien` and `/ai/test-lab`
- Text runner checks: stop-rule match, scenario/intent match, forbidden-action policy on scenario
- Suite pass criterion for gate: `criticalFailed === 0`

## Consequences

- No LLM call in text mode yet (deterministic rules/scenarios)
- Browser voice / phone modes deferred to Stage 5+
- Prompt publish is not yet blocked by Test Lab (wire in next increment)
