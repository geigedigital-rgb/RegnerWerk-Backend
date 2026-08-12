# ADR 012 — Phone calls & telephony (Stage 5 start)

Status: Accepted  
Date: 2026-08-12

## Context

TZ Stage 5 requires call mapping, Calls list, Live view, and telephony settings before full Twilio pilot.

## Decision

- Tables: `phone_calls`, `call_events`, `telephony_settings`
- Gateway posts lifecycle to `POST /api/ai/calls/ingest` (secret optional in local)
- CRM phone match → `contact_id` + timeline event on call end
- UI: `/ai/anrufe`, `/ai/live`, `/ai/telefonie`
- `recording_enabled` remains false until Stage 6

## Consequences

- Twilio SIP wiring still requires real credentials (documented in voice-gateway)
- Operator barge-in / force transfer controls deferred
- Demo ingest can simulate calls without OpenAI
