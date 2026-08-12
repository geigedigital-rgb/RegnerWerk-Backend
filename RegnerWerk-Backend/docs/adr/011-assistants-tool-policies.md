# ADR 011 — Assistants & Tool Policies

Status: Accepted  
Date: 2026-08-12

## Context

TZ §8.2 / §26.15 / §30.8 require versioned assistants that bind prompt/rule/scenario releases and an allowlisted tool policy.

## Decision

- Tables: `ai_assistants`, `ai_assistant_versions`, `tool_policies`, `tool_policy_versions`
- Seed Empfang (+ Reparatur/Neuanlage) and `empfang_default` tool allowlist
- UI `/ai/assistenten` + release overview `/ai/versionen`
- Publish runs critical Test Lab gate and snapshots active release IDs
- Voice Gateway loads `/api/ai/assistants/published` and filters tools by allowlist

## Consequences

- Tool policy editor UI is view-only for now (edit via SQL / later studio)
- Denied tools (`transfer_call` arbitrary, price/date promises) never registered on the agent
