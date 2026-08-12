# ADR 006 — Invite-only Auth & RBAC

Status: Accepted  
Date: 2026-08-12

## Context

TZ Stage 1 requires Supabase Auth, roles, permissions, and server checks. Admin was previously open on :3001.

## Decision

- Middleware session gate for all admin UI and non-public APIs
- Public remain open: `/api/public/*`, `/api/projects/*`, `/api/webhooks/*`, `/api/ai/health`
- Tables: `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`
- First authenticated user with zero role assignments is auto-promoted to `owner`
- Invite-only: no signup UI; create users via `scripts/create-admin-user.mjs` or Supabase Dashboard
- CRM data APIs still use service role after session check (RLS policies for direct client access come later)

## Consequences

- Login at `/login`
- Logout via `/api/auth/logout`
- MFA and fine-grained API permission enforcement are next increments
