# RegnerWerk Voice Gateway

Long-running Node service for OpenAI Realtime SIP + Twilio.

Foundation: [openai-agents-js/examples/realtime-twilio-sip](https://github.com/openai/openai-agents-js/tree/main/examples/realtime-twilio-sip)

## Local

```bash
cd voice-gateway
cp .env.example .env
npm install
npm run dev   # http://localhost:8000/health
```

Without `OPENAI_API_KEY` / `OPENAI_WEBHOOK_SECRET`, `/health` and `/twilio/*` stubs still run; OpenAI webhook accept is disabled.

## Endpoints

| Path | Role |
|---|---|
| `GET /health` | Admin Live status (pilotMode, activeCalls) |
| `POST /openai/webhook` | OpenAI `realtime.call.incoming` |
| `POST /twilio/voice` | Twilio Voice URL → TwiML SIP or placeholder |
| `POST /twilio/status` | Twilio status callback → call ingest |
| `GET /transfer/resolve` | Debug transfer target |

Admin (port 3001) must be up for: CRM lookup, telephony runtime, call ingest, prompts/rules.

## Production wiring (Railway)

1. Deploy this folder as a Railway service (**Root Directory:** `voice-gateway`)
2. Set env vars in Railway (never commit `.env`): `OPENAI_API_KEY`, `OPENAI_WEBHOOK_SECRET`, `ADMIN_API_URL`, …
3. OpenAI Dashboard → Webhooks → URL:

```text
https://<railway-public-domain>/openai/webhook
```

   Event: `realtime.call.incoming` → copy signing secret → `OPENAI_WEBHOOK_SECRET`
4. Twilio Voice URL → `https://<railway-public-domain>/twilio/voice`
5. Set `OPENAI_SIP_URI` when SIP is wired; transfer numbers via Admin → Telefonie or env

See `RegnerWerk-Backend/docs/adr/013-telephony-runtime.md`.
