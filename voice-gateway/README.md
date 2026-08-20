# RegnerWerk Voice Gateway

Long-running Node service: **Telnyx Call Control** → **OpenAI Realtime SIP**.

Foundation: [openai-agents-js/examples/realtime-twilio-sip](https://github.com/openai/openai-agents-js/tree/main/examples/realtime-twilio-sip)

## Local

```bash
cd voice-gateway
cp .env.example .env
npm install
npm run dev   # http://localhost:8000/health
```

Without `OPENAI_API_KEY` / `OPENAI_WEBHOOK_SECRET`, `/health` still runs; OpenAI accept is disabled.
Without `TELNYX_API_KEY` / `OPENAI_SIP_URI`, Telnyx can ACK webhooks but cannot bridge audio.

## Endpoints

| Path | Role |
|---|---|
| `GET /health` | Status (openai / telnyx / SIP flags) |
| `POST /api/webhooks/telnyx` | Telnyx Call Control → answer + transfer to SIP |
| `POST /openai/webhook` | OpenAI `realtime.call.incoming` |
| `POST /twilio/voice` | Legacy Twilio stub |
| `POST /twilio/status` | Legacy Twilio status |
| `GET /transfer/resolve` | Debug transfer target |

Admin (port 3001) must be up for: CRM lookup, telephony runtime, call ingest, prompts/rules.

## Production wiring (Railway)

1. Deploy this folder (**Root Directory:** `voice-gateway`)
2. Set env in Railway (never commit `.env`):

| Var | Required |
|---|---|
| `OPENAI_API_KEY` | yes |
| `OPENAI_WEBHOOK_SECRET` | yes |
| `OPENAI_SIP_URI` | yes (audio path) |
| `TELNYX_API_KEY` | yes |
| `TELNYX_CONNECTION_ID` | recommended |
| `TELNYX_PHONE_NUMBER` | recommended |
| `ADMIN_API_URL` | when Admin is live |

3. **Telnyx** Mission Control → Voice API Application webhook:

```text
https://<railway-public-domain>/api/webhooks/telnyx
```

4. **OpenAI** Dashboard → Webhooks → URL:

```text
https://<railway-public-domain>/openai/webhook
```

   Event: `realtime.call.incoming` → signing secret → `OPENAI_WEBHOOK_SECRET`

5. Status in Admin: **KI → Telefonie**

See `RegnerWerk-Backend/docs/adr/013-telephony-runtime.md`.
