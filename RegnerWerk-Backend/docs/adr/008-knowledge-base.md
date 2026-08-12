# ADR 008 — Knowledge Base

Status: Accepted  
Date: 2026-08-12

## Context

TZ §14 requires approved knowledge for assistants without dumping the whole corpus into every call.

## Decision

- Tables: `knowledge_categories`, `knowledge_articles`
- Seed DE core articles (about, services, pricing boundaries, legal, …)
- Admin UI `/ai/wissen`: create/edit draft, publish
- Gateway feed: `GET /api/ai/knowledge/published`
- Sensitivity flags: `normal | price | legal | internal`

## Consequences

- Retrieval tool / core-context packing deferred
- Article version history is a single version counter for now (full version table later)
