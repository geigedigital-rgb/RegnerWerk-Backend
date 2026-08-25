# RegnerWerk-Backend

Внутренняя Operations-платформа: Produkte, Sofort-Projekte, CRM, KI-Assistent.

## Запуск

```bash
cp .env.example .env.local   # заполнить Supabase keys
npm install
npm run dev                  # Admin UI http://localhost:3001

# Voice Gateway (отдельный процесс)
cd ../voice-gateway && cp .env.example .env && npm install && npm run dev
# или из admin: npm run dev:gateway  → http://localhost:8000/health
```

Корень продуктовых данных: `PRODUCTS_DIR` (по умолчанию `../../RegnerWerk/data`).

## Рабочие пространства

| Workspace | URL | Содержание |
|-----------|-----|------------|
| Produkte | `/produkte` | Katalog JSON |
| Projekte | `/projekte` | Sofort-Konfigurator (Supabase `projects`) |
| CRM | `/crm` | Kunden / Leads / Pipeline (Phase 1+) |
| KI-Assistent | `/ai` | Voice / Prompts / Regeln |

Старые URL `/products` и `/projects` редиректятся.

## Supabase (Sofort-проекты)

1. Один раз выполнить SQL: [`../supabase/migrations/001_projects.sql`](../supabase/migrations/001_projects.sql)
2. Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ALLOWED_ORIGINS`, `FRONTEND_URL`, `NEXT_PUBLIC_FRONTEND_URL`,
   `VOICE_GATEWAY_URL`.

### API Sofort-проектов

| Method | Path | Назначение |
|--------|------|------------|
| POST | `/api/projects/submit` | Сохранить проект + PDF |
| POST | `/api/projects/pdf` | PDF |
| GET | `/api/projects` | Список |
| GET | `/api/projects/[id]` | Полный проект |
| POST | `/api/projects/[id]/duplicate` | Дубль |
| GET | `/api/projects/[id]/pdf` | Скачать PDF |
| DELETE | `/api/projects/[id]` | Удалить |

### AI health

`GET /api/ai/health` → Voice Gateway `/health`

## CRM (Stage 1 vertical slice)

Migration: [`../supabase/migrations/002_crm_foundation.sql`](../supabase/migrations/002_crm_foundation.sql)

```bash
# via DATABASE_URL in .env.local (Node + pg), or:
SUPABASE_ACCESS_TOKEN=sbp_… node scripts/apply-crm-sql.mjs
# or paste SQL into Supabase SQL Editor
```

Live screens:

- `/crm` — Übersicht (attention counts)
- `/crm/inbox` — triage (manual create, accept → lead, reject, spam)
- `/crm/leads`, `/crm/leads/[id]` — lead + timeline + task
- `/crm/kunden`, `/crm/kunden/[id]` — contact + channels + timeline

API: `/api/crm/overview|inbox|leads|contacts|tasks`

### Public website leads

`POST /api/public/leads` — idempotent (`submission_id`), rate-limited, CORS via `ALLOWED_ORIGINS`.

Response: `{ accepted: true, reference: "RW-2026-…", request_id }`.

Creates `web_form_submissions` + Inbox item. Marketing site proxies via `/api/contact` and `/api/projekt-anfrage` (`BACKEND_URL`).

### Pipeline & Montage (Stage 3)

Migration: [`../supabase/migrations/004_pipeline_montage.sql`](../supabase/migrations/004_pipeline_montage.sql)

- Lead → `POST /api/crm/leads/[id]/convert`
- Pipeline Kanban: `/crm/pipeline`
- Move stage / Won / Lost: `POST /api/crm/opportunities/[id]`
- Won → `montage_projects` (table separate from Sofort `projects`)
- Liste: `/crm/montageprojekte`

### Service (Stage 3)

Migration: [`../supabase/migrations/005_service_cases.sql`](../supabase/migrations/005_service_cases.sql)

- `/crm/service` — offene Fälle, manuell anlegen
- Lead → `POST /api/crm/leads/[id]/service`
- Rohrbruch/Wasserschaden → `urgent` + `emergency_water`

### Auth (Stage 1)

Migration: [`../supabase/migrations/006_auth_rbac.sql`](../supabase/migrations/006_auth_rbac.sql)

```bash
# Create first owner (after migration)
node scripts/create-admin-user.mjs you@regnerwerk.de 'YourStrongPassword!'
```

- Login: http://localhost:3001/login
- Requires `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- Public APIs stay open: `/api/public/*`, `/api/projects`, `/api/projects/*`

### Prompt Studio (Stage 4 start)

Migration: [`../supabase/migrations/007_prompt_studio.sql`](../supabase/migrations/007_prompt_studio.sql)

- UI: http://localhost:3001/ai/prompts
- Draft / Publish / Rollback APIs under `/api/ai/prompts/*`
- Voice Gateway loads active release via `/api/ai/prompts/published`

### Knowledge & Rules (Stage 4)

Migrations: [`008_knowledge_base.sql`](../supabase/migrations/008_knowledge_base.sql), [`009_rules_stop_triggers.sql`](../supabase/migrations/009_rules_stop_triggers.sql)

- Wissensbasis: http://localhost:3001/ai/wissen
- Regeln: http://localhost:3001/ai/regeln
- Gateway: `/api/ai/knowledge/published`, `/api/ai/rules/published`

### Scenarios & Test Lab (Stage 4)

Migration: [`010_scenarios_test_lab.sql`](../supabase/migrations/010_scenarios_test_lab.sql)

- Szenarien: http://localhost:3001/ai/szenarien
- Test Lab (text): http://localhost:3001/ai/test-lab
- Prompt publish is blocked if critical Test Lab cases fail

### Assistants & Tool Policies (Stage 4)

Migration: [`011_assistants_tool_policies.sql`](../supabase/migrations/011_assistants_tool_policies.sql)

- Assistenten: http://localhost:3001/ai/assistenten
- Versionen: http://localhost:3001/ai/versionen
- Gateway: `/api/ai/assistants/published`

### Phone Calls & Telephony (Stage 5 start)

Migration: [`012_phone_calls_telephony.sql`](../supabase/migrations/012_phone_calls_telephony.sql)

- Anrufe: http://localhost:3001/ai/anrufe
- Live: http://localhost:3001/ai/live
- Telefonie: http://localhost:3001/ai/telefonie
- Gateway ingest: `POST /api/ai/calls/ingest`
- CRM lookup: `GET /api/ai/crm/lookup`
- Runtime: `GET /api/ai/telephony/runtime`
- Live operator: urgent / transfer
- Twilio stubs on gateway: `/twilio/voice`, `/twilio/status`

### CRM ↔ Konfigurator / Website

Migration: [`013_crm_sofort_link.sql`](../supabase/migrations/013_crm_sofort_link.sql)

- Website-Formulare (`/api/public/leads`) legen automatisch Kontakt + Lead an
- Konfigurator-Submit mit E-Mail verknüpft `projects.contact_id` und zeigt Plan/PDF auf der Kundenkarte
- `FRONTEND_URL` / `NEXT_PUBLIC_FRONTEND_URL` = Konfigurator-Domain (lokal `:3002`)

## Документация

- [RegnerWerk_CRM_AI_TZ.md](./RegnerWerk_CRM_AI_TZ.md)
- [ADR 001 — Workspaces](./docs/adr/001-admin-workspaces.md)
- [ADR 002 — Voice Gateway](./docs/adr/002-voice-gateway-foundation.md)
- [ADR 003 — CRM foundation](./docs/adr/003-crm-foundation.md)
- [ADR 006 — Auth & RBAC](./docs/adr/006-auth-rbac.md)
- [ADR 007 — Prompt Studio](./docs/adr/007-prompt-studio.md)
- [ADR 008 — Knowledge Base](./docs/adr/008-knowledge-base.md)
- [ADR 009 — Rules & Stop Triggers](./docs/adr/009-rules-stop-triggers.md)
- [ADR 010 — Scenarios & Test Lab](./docs/adr/010-scenarios-test-lab.md)
- [ADR 011 — Assistants & Tool Policies](./docs/adr/011-assistants-tool-policies.md)
- [ADR 012 — Phone Calls & Telephony](./docs/adr/012-phone-calls-telephony.md)
- [ADR 013 — Telephony runtime](./docs/adr/013-telephony-runtime.md)
- [ADR 014 — Website + Konfigurator CRM](./docs/adr/014-crm-website-configurator.md)
- [Voice Gateway README](../voice-gateway/README.md)
