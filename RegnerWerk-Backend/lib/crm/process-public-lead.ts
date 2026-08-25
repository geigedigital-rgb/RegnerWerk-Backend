import { createHash, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createInboxItem, addTimelineEvent, acceptInboxAsLead } from "@/lib/crm";
import {
  extractPostalCode,
  inferRequestType,
  nextReferenceCode,
  type PublicLeadInput,
} from "@/lib/crm/public-leads";

function ipHash(ip: string): string {
  return createHash("sha256").update(`rw-lead:${ip}`).digest("hex").slice(0, 32);
}

function uaClass(ua: string | null): string {
  if (!ua) return "unknown";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  if (/bot|crawl|spider/i.test(ua)) return "bot";
  return "desktop";
}

export type ProcessPublicLeadResult = {
  accepted: true;
  reference: string;
  duplicate?: boolean;
  inboxItemId?: string;
};

/**
 * Idempotent website → Inbox intake (TZ §10.1 / §30.2).
 * Does not reveal whether a customer already exists.
 */
export async function processPublicLead(opts: {
  input: PublicLeadInput;
  ip: string;
  userAgent: string | null;
}): Promise<ProcessPublicLeadResult> {
  const { input, ip, userAgent } = opts;
  const sb = getSupabaseAdmin();

  // Honeypot: pretend success, no CRM write
  if (input.company_website?.trim()) {
    return { accepted: true, reference: nextReferenceCode() };
  }

  const { data: existing, error: exErr } = await sb
    .from("web_form_submissions")
    .select("reference_code, inbox_item_id, processing_status")
    .eq("submission_id", input.submission_id)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);

  if (existing) {
    return {
      accepted: true,
      reference: existing.reference_code as string,
      duplicate: true,
      inboxItemId: (existing.inbox_item_id as string | null) ?? undefined,
    };
  }

  const requestType = inferRequestType(input);
  const postal = extractPostalCode(input.postal_code, input.address);
  const reference = nextReferenceCode();
  const summaryParts = [
    input.message?.trim(),
    input.garden_type ? `Garten: ${input.garden_type}` : null,
    input.area_m2 ? `Fläche: ${input.area_m2} m²` : null,
  ].filter(Boolean);
  const summary =
    summaryParts.join(" · ") ||
    `Website-Anfrage (${input.form_type}) von ${input.name}`;

  const payloadSanitized = {
    name: input.name,
    phone: input.phone || null,
    email: input.email || null,
    postal_code: postal,
    address: input.address || null,
    area_m2: input.area_m2 ?? null,
    water_source: input.water_source || null,
    existing_system: input.existing_system ?? null,
    garden_type: input.garden_type || null,
    message: input.message || null,
    callback_requested: input.callback_requested ?? null,
    callback_window: input.callback_window || null,
    callback_consent: input.callback_consent ?? null,
    privacy_notice_version: input.privacy_notice_version || "2026-08-01",
    request_type: requestType,
  };

  const inbox = await createInboxItem({
    source_type: "website",
    summary,
    request_type: requestType,
    contact_name: input.name,
    contact_phone: input.phone || undefined,
    contact_email: input.email || undefined,
    postal_code: postal || undefined,
    priority: requestType === "repair" ? "high" : "normal",
    payload: {
      submission_id: input.submission_id,
      form_type: input.form_type,
      landing_page: input.landing_page,
      utm: input.utm ?? {},
      reference,
    },
  });

  const { error: insErr } = await sb.from("web_form_submissions").insert({
    submission_id: input.submission_id,
    form_type: input.form_type,
    payload_sanitized: payloadSanitized,
    landing_page: input.landing_page || null,
    referrer: input.referrer || null,
    utm: input.utm ?? {},
    ip_hash: ipHash(ip),
    user_agent_class: uaClass(userAgent),
    captcha_result: null,
    processing_status: "processed",
    reference_code: reference,
    inbox_item_id: inbox.id,
  });

  if (insErr) {
    // Race on unique submission_id → treat as duplicate
    if (insErr.code === "23505") {
      const { data: again } = await sb
        .from("web_form_submissions")
        .select("reference_code, inbox_item_id")
        .eq("submission_id", input.submission_id)
        .maybeSingle();
      return {
        accepted: true,
        reference: (again?.reference_code as string) || reference,
        duplicate: true,
        inboxItemId: (again?.inbox_item_id as string | null) ?? undefined,
      };
    }
    throw new Error(insErr.message);
  }

  let leadId: string | undefined;
  let contactId = inbox.suggested_contact_id;
  try {
    const accepted = await acceptInboxAsLead(inbox.id, { actor: "system" });
    leadId = accepted.lead.id;
    contactId = accepted.contact.id;
    await sb
      .from("web_form_submissions")
      .update({ lead_id: accepted.lead.id })
      .eq("submission_id", input.submission_id);
  } catch (err) {
    console.error("[public-leads] auto-accept failed", err);
  }

  await addTimelineEvent({
    type: "website_submission_received",
    title: "Website-Anfrage eingegangen",
    summary: `${input.name} · ${reference}`,
    source: "website",
    actor_type: "customer",
    inbox_item_id: inbox.id,
    contact_id: contactId,
    lead_id: leadId,
    payload: {
      reference,
      form_type: input.form_type,
      submission_id: input.submission_id,
    },
  });

  return {
    accepted: true,
    reference,
    inboxItemId: inbox.id,
  };
}

export function newSubmissionId(): string {
  return randomUUID();
}
