/**
 * Telnyx Call Control API v2 — answer inbound PSTN and transfer to OpenAI Realtime SIP.
 */

const TELNYX_API = "https://api.telnyx.com/v2";

export type TelnyxWebhookEnvelope = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: {
      call_control_id?: string;
      call_leg_id?: string;
      call_session_id?: string;
      connection_id?: string;
      from?: string;
      to?: string;
      direction?: string;
      state?: string;
      hangup_cause?: string;
      hangup_source?: string;
    };
  };
  meta?: { attempt?: number; delivered_to?: string };
};

export function telnyxConfigured(): boolean {
  return Boolean(process.env.TELNYX_API_KEY?.trim());
}

export function openaiSipConfigured(): boolean {
  return Boolean(process.env.OPENAI_SIP_URI?.trim());
}

function authHeaders(): HeadersInit {
  const key = process.env.TELNYX_API_KEY?.trim();
  if (!key) throw new Error("TELNYX_API_KEY missing");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function callAction(
  callControlId: string,
  action: "answer" | "transfer" | "hangup" | "reject",
  body: Record<string, unknown> = {},
): Promise<unknown> {
  const res = await fetch(
    `${TELNYX_API}/calls/${encodeURIComponent(callControlId)}/actions/${action}`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    },
  );
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      `Telnyx ${action} failed (${res.status}): ${typeof json === "object" && json && "errors" in json ? JSON.stringify((json as { errors: unknown }).errors) : text}`,
    );
    (err as Error & { status?: number; body?: unknown }).status = res.status;
    (err as Error & { body?: unknown }).body = json;
    throw err;
  }
  return json;
}

export async function answerCall(callControlId: string): Promise<unknown> {
  return callAction(callControlId, "answer", {});
}

/** Bridge caller to OpenAI Realtime SIP URI (same role as Twilio `<Dial><Sip>`). */
export async function transferToSip(
  callControlId: string,
  sipUri: string,
  fromNumber?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = { to: sipUri };
  if (fromNumber) body.from = fromNumber;
  return callAction(callControlId, "transfer", body);
}

export async function hangupCall(callControlId: string): Promise<unknown> {
  return callAction(callControlId, "hangup", {});
}

export function parseTelnyxEvent(body: unknown): {
  eventType: string;
  eventId: string | null;
  callControlId: string | null;
  from: string | null;
  to: string | null;
  direction: string | null;
  hangupCause: string | null;
} {
  const env = body as TelnyxWebhookEnvelope;
  const payload = env.data?.payload ?? {};
  return {
    eventType: env.data?.event_type ?? "",
    eventId: env.data?.id ?? null,
    callControlId: payload.call_control_id ?? null,
    from: payload.from ?? null,
    to: payload.to ?? null,
    direction: payload.direction ?? null,
    hangupCause: payload.hangup_cause ?? null,
  };
}
