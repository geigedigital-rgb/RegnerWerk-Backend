# ADR 007 — Prompt Studio (versioned blocks)

Status: Accepted  
Date: 2026-08-12

## Context

TZ §13 requires editable assistant behavior without code changes, with drafts, immutable releases, and rollback.

## Decision

- Tables: `prompt_documents`, `prompt_versions`, `prompt_releases`
- Seed Empfang blocks (Identity → Fallback); security blocks marked `locked`
- Admin UI `/ai/prompts`: edit draft, compiled preview, publish, rollback
- Permissions: `ai.prompt.edit` (draft), `ai.prompt.publish` (release/rollback)
- Voice Gateway still uses local stub until it consumes active `prompt_releases`

## Consequences

- Production publish creates one active release per environment
- Rollback clones prior compiled content as a new active release
- Full test-gate / approval workflow deferred
