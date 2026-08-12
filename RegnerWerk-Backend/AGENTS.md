<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:rtk -->
# RTK (Rust Token Killer)

Shell commands are auto-rewritten by the Cursor preToolUse hook (`rtk hook cursor`). Prefer shell for noisy ops so RTK can compress output. Meta: `rtk gain`, `rtk discover`, `rtk proxy <cmd>`. Built-in Read/Grep/Glob bypass the hook — use `rtk read` / `rtk grep` / `rtk find` when you want compact output.
<!-- END:rtk -->

<!-- BEGIN:project -->
# RegnerWerk-Backend

Admin Operations Platform (Next.js 16, port **3001**):

- **Produkte** `/produkte` — catalog JSON under `../../RegnerWerk/data`
- **Projekte** `/projekte` — Sofort configurator projects (Supabase)
- **CRM** `/crm` — Inbox → Lead → Kunde → Timeline → Task (Stage 1)
- **KI-Assistent** `/ai` — voice ops shell + Voice Gateway `:8000`

TZ: `RegnerWerk_CRM_AI_TZ.md`. Navigation: `config/navigation.ts`.
CRM lib: `lib/crm/`. Migration: `../supabase/migrations/002_crm_foundation.sql`.
Voice Gateway: `../voice-gateway` (openai-agents-js SIP foundation).
<!-- END:project -->
