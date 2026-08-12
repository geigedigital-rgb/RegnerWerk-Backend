# ADR 003 — CRM data foundation

Status: Accepted  
Date: 2026-08-12

## Context

TZ Stage 1 requires contacts, channels, inbox, leads, timeline, tasks without breaking Sofort `projects`.

## Decision

- Migration `supabase/migrations/002_crm_foundation.sql`
- Separate entities: `contacts`, `contact_channels`, `properties`, `inbox_items`, `leads`, `timeline_events`, `tasks`
- Sofort table `public.projects` untouched (UI label Sofort-Projekte)
- RLS enabled, no anon policies — service role via admin API only (Auth/RBAC next)
- Vertical slice UI: Übersicht, Inbox triage, Lead card, Customer card + Timeline + Task create

## Consequences

- Website public lead API and Auth are still pending
- Pipeline / Service / Montageprojekte remain placeholders
- Apply with `DATABASE_URL` + `pg`, or SQL Editor / `scripts/apply-crm-sql.mjs`
