/**
 * Persist call metadata via Admin ingest API (phone_calls).
 */

function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const secret = process.env.VOICE_GATEWAY_SECRET;
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["x-voice-gateway-key"] = secret;
  }
  return headers;
}

function adminUrl(path: string) {
  const base = (
    process.env.ADMIN_API_URL ||
    process.env.REGNERWERK_ADMIN_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
  return `${base}${path}`;
}

export async function createCallRecord(input: {
  openaiCallId: string;
  fromNumber?: string;
  toNumber?: string;
  correlationId?: string;
}): Promise<{ id: string }> {
  try {
    const res = await fetch(adminUrl("/api/ai/calls/ingest"), {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        openaiCallId: input.openaiCallId,
        event: "incoming",
        fromNumber: input.fromNumber ?? null,
        toNumber: input.toNumber ?? null,
        metadata: { correlationId: input.correlationId },
        aiMode: "after_hours",
        assistantCode: "empfang",
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn("[calls] ingest incoming failed", await res.text());
      return { id: `local-${input.openaiCallId}` };
    }
    const data = (await res.json()) as { call?: { id: string } };
    return { id: data.call?.id ?? `local-${input.openaiCallId}` };
  } catch (e) {
    console.warn("[calls] ingest incoming error", e);
    return { id: `local-${input.openaiCallId}` };
  }
}

export async function updateCallLifecycle(input: {
  openaiCallId: string;
  event: "accepted" | "in_progress" | "ended" | "failed" | "transferring";
  outcome?: string;
  summary?: string;
  errorCode?: string;
}): Promise<void> {
  try {
    const res = await fetch(adminUrl("/api/ai/calls/ingest"), {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        openaiCallId: input.openaiCallId,
        event: input.event,
        outcome: input.outcome,
        summary: input.summary,
        errorCode: input.errorCode,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn("[calls] lifecycle failed", input.event, await res.text());
    }
  } catch (e) {
    console.warn("[calls] lifecycle error", input.event, e);
  }
}

export async function saveCallFact(input: {
  callId: string;
  fieldKey: string;
  value: unknown;
  confidence?: number;
}): Promise<void> {
  console.info("[supabase] saveCallFact stub", input);
}
