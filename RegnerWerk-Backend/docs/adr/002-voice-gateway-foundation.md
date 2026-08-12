# ADR 002 — Voice Gateway foundation

Status: Accepted  
Date: 2026-08-12

## Context

TZ §29 requires a long-running Voice Gateway for OpenAI Realtime SIP + Twilio, not a short-lived serverless WebSocket host. Official foundation: `openai/openai-agents-js` example `realtime-twilio-sip`.

## Decision

- New app at `RegnerWerk-Backend/voice-gateway/` (sibling of Next admin)
- Depend on `@openai/agents` + Fastify webhook pattern from the official example
- RegnerWerk-specific modules as stubs: `supabase`, `crm-lookup`, `prompts`, `stop-rules`, `transfer`
- Allowlisted tools only (TZ §30.8); transfer targets chosen server-side
- Admin polls `VOICE_GATEWAY_URL/health` via `/api/ai/health`
- Gateway starts without OpenAI keys (health only) for local UI development

## Consequences

- Two processes locally: admin `:3001`, gateway `:8000`
- Live Twilio/SIP wiring comes in TZ Phase 5
- Recording after consent (Programmable Voice) comes in Phase 6 — not trunk-wide recording
