# RegnerWerk-Backend (monorepo)

| Path | Role | Local |
|------|------|-------|
| `RegnerWerk-Backend/` | Admin Next.js (CRM + KI) | `:3001` |
| `voice-gateway/` | Telnyx Call Control + OpenAI Realtime SIP | `:8000` |
| `supabase/` | SQL migrations | — |

## Railway

**Default deploy (repo root)** = `voice-gateway` via root `package.json` + `railway.toml`.

| Service | Root Directory | Port / notes |
|---------|----------------|--------------|
| Voice Gateway (default) | `/` or `voice-gateway` | `/health`, `/api/webhooks/telnyx`, `/openai/webhook` |
| Admin Next.js | `RegnerWerk-Backend` | set `PORT` / Next start |

### Voice Gateway variables (do not commit)

- `OPENAI_API_KEY`
- `OPENAI_WEBHOOK_SECRET` (OpenAI Dashboard → webhook signing secret)
- `OPENAI_SIP_URI` (`sip:…` from OpenAI Realtime SIP)
- `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_PHONE_NUMBER`
- `ADMIN_API_URL` (prod admin URL when ready)
- optional: `VOICE_GATEWAY_SECRET`, transfer E.164, Supabase

Telnyx webhook (Mission Control → Voice API Application):

```text
https://<your-railway-domain>/api/webhooks/telnyx
```

OpenAI webhook:

```text
https://<your-railway-domain>/openai/webhook
```

Flow: Telnyx inbound → answer + transfer to `OPENAI_SIP_URI` → OpenAI `realtime.call.incoming` → accept on gateway.  
Health: `GET /health`
