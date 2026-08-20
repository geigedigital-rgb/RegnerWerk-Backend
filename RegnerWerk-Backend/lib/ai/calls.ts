import { getSupabaseAdmin } from "@/lib/supabase";
import { addTimelineEvent } from "@/lib/crm";

export type PhoneCall = {
  id: string;
  created_at: string;
  updated_at: string;
  direction: string;
  provider: string;
  openai_realtime_call_id: string | null;
  correlation_id: string;
  from_number_e164: string | null;
  to_number_e164: string | null;
  from_number_raw: string | null;
  contact_id: string | null;
  lead_id: string | null;
  match_status: string;
  status: string;
  outcome: string | null;
  urgency: string;
  review_status: string;
  ai_mode: string;
  assistant_code: string | null;
  summary: string | null;
  recording_consent_status: string;
  error_code: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
};

export type CallEvent = {
  id: string;
  call_id: string;
  event_type: string;
  sequence: number;
  occurred_at: string;
  payload_redacted: Record<string, unknown>;
};

const LIVE_STATUSES = [
  "ringing",
  "accepted",
  "in_progress",
  "transferring",
] as const;

function normalizeE164(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+") && digits.length >= 10) return digits;
  const only = raw.replace(/\D/g, "");
  if (only.length >= 10) return `+${only}`;
  return raw.trim() || null;
}

async function appendEvent(
  callId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
) {
  const sb = getSupabaseAdmin();
  const { data: last } = await sb
    .from("call_events")
    .select("sequence")
    .eq("call_id", callId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  await sb.from("call_events").insert({
    call_id: callId,
    event_type: eventType,
    sequence: (last?.sequence ?? 0) + 1,
    payload_redacted: payload,
  });
}

async function matchContactByPhone(e164: string | null): Promise<{
  contactId: string | null;
  matchStatus: PhoneCall["match_status"];
}> {
  if (!e164) return { contactId: null, matchStatus: "unknown" };
  const { findContactsByPhone } = await import("@/lib/crm");
  const contacts = await findContactsByPhone(e164);
  if (contacts.length === 1) {
    return { contactId: contacts[0].id, matchStatus: "matched" };
  }
  if (contacts.length > 1) {
    return { contactId: contacts[0].id, matchStatus: "ambiguous" };
  }
  return { contactId: null, matchStatus: "new" };
}

export async function listPhoneCalls(opts?: {
  status?: string;
  limit?: number;
  liveOnly?: boolean;
}): Promise<PhoneCall[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("phone_calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.liveOnly) q = q.in("status", [...LIVE_STATUSES]);
  else if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PhoneCall[];
}

export async function getPhoneCall(id: string): Promise<{
  call: PhoneCall;
  events: CallEvent[];
} | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("phone_calls")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { data: events } = await sb
    .from("call_events")
    .select("*")
    .eq("call_id", id)
    .order("sequence", { ascending: true });
  return {
    call: data as PhoneCall,
    events: (events ?? []) as CallEvent[],
  };
}

export async function ingestCallEvent(input: {
  openaiCallId: string;
  event: "incoming" | "accepted" | "in_progress" | "ended" | "failed" | "transferring";
  fromNumber?: string | null;
  toNumber?: string | null;
  outcome?: string | null;
  summary?: string | null;
  errorCode?: string | null;
  assistantCode?: string | null;
  model?: string | null;
  aiMode?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<PhoneCall> {
  const sb = getSupabaseAdmin();
  const e164 = normalizeE164(input.fromNumber);
  const { data: existing } = await sb
    .from("phone_calls")
    .select("*")
    .eq("openai_realtime_call_id", input.openaiCallId)
    .maybeSingle();

  if (!existing) {
    const match = await matchContactByPhone(e164);
    const { data, error } = await sb
      .from("phone_calls")
      .insert({
        openai_realtime_call_id: input.openaiCallId,
        from_number_e164: e164,
        from_number_raw: input.fromNumber ?? null,
        to_number_e164: normalizeE164(input.toNumber),
        contact_id: match.contactId,
        match_status: match.matchStatus,
        status:
          input.event === "incoming"
            ? "ringing"
            : input.event === "failed"
              ? "failed"
              : "accepted",
        assistant_code: input.assistantCode ?? "empfang",
        model: input.model ?? null,
        ai_mode: input.aiMode ?? "after_hours",
        answered_at:
          input.event === "accepted" || input.event === "in_progress"
            ? new Date().toISOString()
            : null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await appendEvent(data.id, `call.${input.event}`, {
      from: e164,
    });
    return data as PhoneCall;
  }

  const patch: Record<string, unknown> = {
    metadata: {
      ...((existing.metadata as object) ?? {}),
      ...(input.metadata ?? {}),
    },
  };

  if (input.event === "accepted" || input.event === "in_progress") {
    patch.status = input.event === "accepted" ? "accepted" : "in_progress";
    if (!existing.answered_at) patch.answered_at = new Date().toISOString();
  }
  if (input.event === "transferring") patch.status = "transferring";
  if (input.event === "failed") {
    patch.status = "failed";
    patch.ended_at = new Date().toISOString();
    patch.error_code = input.errorCode ?? "gateway_error";
    if (input.outcome) patch.outcome = input.outcome;
  }
  if (input.summary) patch.summary = input.summary;
  if (input.event === "ended") {
    patch.status =
      existing.status === "transferring" ? "transferred" : "completed";
    patch.ended_at = new Date().toISOString();
    if (input.outcome) patch.outcome = input.outcome;
    if (existing.answered_at) {
      patch.duration_seconds = Math.max(
        0,
        Math.round(
          (Date.now() - new Date(existing.answered_at).getTime()) / 1000,
        ),
      );
    }
  }

  const { data, error } = await sb
    .from("phone_calls")
    .update(patch)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await appendEvent(data.id, `call.${input.event}`, {
    outcome: input.outcome,
    error: input.errorCode,
  });

  if (input.event === "ended" && data.contact_id) {
    await addTimelineEvent({
      contact_id: data.contact_id,
      type: "call",
      title: "Telefonat (KI Empfang)",
      summary:
        data.summary ||
        `Anruf ${data.from_number_e164 ?? "unbekannt"} — ${data.outcome ?? data.status}`,
      source: "voice_gateway",
      actor_type: "ai",
      payload: {
        call_id: data.id,
        openai_realtime_call_id: data.openai_realtime_call_id,
      },
    });
  }

  return data as PhoneCall;
}

export async function updatePhoneCall(
  id: string,
  patch: Partial<
    Pick<
      PhoneCall,
      | "summary"
      | "outcome"
      | "review_status"
      | "urgency"
      | "status"
    >
  >,
): Promise<PhoneCall> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("phone_calls")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PhoneCall;
}

export async function getTelephonySettings(): Promise<
  Record<string, unknown>
> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("telephony_settings").select("key, value");
  if (error) throw new Error(error.message);
  const out: Record<string, unknown> = {};
  for (const row of data ?? []) {
    out[row.key] = row.value;
  }
  return out;
}

export async function updateTelephonySetting(
  key: string,
  value: unknown,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("telephony_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
