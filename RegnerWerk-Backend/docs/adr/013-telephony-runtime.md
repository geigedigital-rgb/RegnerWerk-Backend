# ADR 013 — Stage 5 telephony runtime (lookup, Twilio skeleton, operator)

Status: Accepted  
Date: 2026-08-12

## Context

Stage 5 needs CRM match, transfer targets from Admin settings, Twilio entry, and operator actions before consent/recording (Stage 6).

## Decision

- `GET /api/ai/crm/lookup` — minimal phone match for gateway
- `GET /api/ai/telephony/runtime` — pilot mode, transfers, fallback flags
- Gateway: pilot_off reject, CRM match summary on accept, `/twilio/voice` + `/twilio/status`
- Live UI operator actions: mark_urgent, request_transfer (+ callback task)
- Transfer numbers: Admin settings preferred, env fallback

## Consequences

- Real SIP URI still required (`OPENAI_SIP_URI`) for live audio path
- Twilio signature validation deferred until credentials exist
- Recording remains disabled
