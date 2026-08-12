# RegnerWerk-Backend (monorepo)

| Path | Role | Local |
|------|------|-------|
| `RegnerWerk-Backend/` | Admin Next.js (CRM + KI) | `:3001` |
| `voice-gateway/` | OpenAI Realtime SIP + Twilio | `:8000` |
| `supabase/` | SQL migrations | — |

## Voice Gateway on Railway

1. New Railway service → connect this GitHub repo
2. **Root Directory:** `voice-gateway`
3. Set variables (Dashboard → Variables), **do not commit secrets**:
   - `OPENAI_API_KEY`
   - `OPENAI_WEBHOOK_SECRET` (from OpenAI webhook after create)
   - `ADMIN_API_URL` (prod admin URL when ready)
   - optional: `OPENAI_SIP_URI`, `VOICE_GATEWAY_SECRET`, transfer E.164, Supabase
4. Public URL for OpenAI webhook:

```text
https://<your-railway-domain>/openai/webhook
```

Event type: `realtime.call.incoming`

Health: `GET /health`
