# RegnerWerk-Backend (monorepo)

| Path | Role | Local |
|------|------|-------|
| `RegnerWerk-Backend/` | Admin Next.js (CRM + KI) | `:3001` |
| `voice-gateway/` | OpenAI Realtime SIP + Twilio | `:8000` |
| `supabase/` | SQL migrations | — |

## Railway

**Default deploy (repo root)** = `voice-gateway` via root `package.json` + `railway.toml`.

| Service | Root Directory | Port / notes |
|---------|----------------|--------------|
| Voice Gateway (default) | `/` or `voice-gateway` | `/health`, `/openai/webhook` |
| Admin Next.js | `RegnerWerk-Backend` | set `PORT` / Next start |

### Voice Gateway variables (do not commit)

- `OPENAI_API_KEY`
- `OPENAI_WEBHOOK_SECRET` (from OpenAI webhook after create)
- `ADMIN_API_URL` (prod admin URL when ready)
- optional: `OPENAI_SIP_URI`, `VOICE_GATEWAY_SECRET`, transfer E.164, Supabase

OpenAI webhook URL:

```text
https://<your-railway-domain>/openai/webhook
```

Event: `realtime.call.incoming` · Health: `GET /health`
