# RegnerWerk Voice Gateway

**Telnyx TeXML Dial → OpenAI Realtime SIP** (same pattern as Twilio Elastic SIP / OpenAI docs).

## Call flow

1. Caller dials Telnyx DID  
2. Telnyx fetches `GET /texml/inbound` → `<Dial><Sip>OPENAI_SIP_URI</Sip></Dial>`  
3. OpenAI fires `POST /openai/webhook` (`realtime.call.incoming`)  
4. Gateway accepts (slim session) + WebSocket sideband (tools / welcome / CRM)

## Local

```bash
cd voice-gateway
cp .env.example .env
npm install
npm run dev   # http://localhost:8000/health
```

## Endpoints

| Path | Role |
|---|---|
| `GET /health` | Status |
| `GET|POST /texml/inbound` | TeXML → Dial OpenAI SIP |
| `POST /texml/status` | TeXML status callback |
| `POST /openai/webhook` | Accept + observe Realtime call |
| `POST /api/webhooks/telnyx` | Legacy Call Control ACK only |

## Telnyx setup

1. TeXML Application voice URL → `https://<gateway>/texml/inbound`  
2. Assign DID `connection_id` to that TeXML application  
3. Outbound Voice Profile on the TeXML app (needed to Dial SIP)  
4. OpenAI project webhook → `https://<gateway>/openai/webhook`

## Env (Railway)

| Var | Required |
|---|---|
| `OPENAI_API_KEY` | yes |
| `OPENAI_WEBHOOK_SECRET` | yes |
| `OPENAI_SIP_URI` | yes |
| `TELNYX_TEXML_APPLICATION_ID` | recommended |
| `TELNYX_PHONE_NUMBER` | recommended |
| `ADMIN_API_URL` / Supabase | for CRM + published assistant |
