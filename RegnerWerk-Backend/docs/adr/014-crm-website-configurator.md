# ADR 014 — Website + Konfigurator → CRM customer card

Status: Accepted  
Date: 2026-08-14

## Context

Website forms only created Inbox rows. Configurator submit stored Sofort `projects` with email columns and never created a contact. Staff saw projects without a Kundenkarte.

## Decision

- Website `POST /api/public/leads` still writes Inbox + `web_form_submissions`, then auto-accepts as Lead/Contact (match by email, then phone).
- Configurator `POST /api/projects/submit` with email: find-or-create contact, attach open lead, set `projects.contact_id` / `lead_id`.
- Customer detail shows Konfigurator-Projekte (PDF + open in planner).
- Same email on site and configurator lands on one contact.

## Consequences

- Run `013_crm_sofort_link.sql` before relying on the link columns.
- Inbox website items appear as accepted, not open.
- Real outbound email is still later.
