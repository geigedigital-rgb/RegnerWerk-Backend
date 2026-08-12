/**
 * Runtime telephony config from Admin (+ env fallback).
 */
export type TelephonyRuntime = {
  pilotMode: string;
  transferOfficeE164: string | null;
  transferEmergencyE164: string | null;
  fallbackPolicy: {
    on_ai_failure?: string;
    on_transfer_failure?: string;
  };
  recordingEnabled: boolean;
};

let cache: { at: number; value: TelephonyRuntime } | null = null;

const FALLBACK: TelephonyRuntime = {
  pilotMode: "after_hours",
  transferOfficeE164: null,
  transferEmergencyE164: null,
  fallbackPolicy: {
    on_ai_failure: "create_callback_task",
    on_transfer_failure: "create_callback_task",
  },
  recordingEnabled: false,
};

function adminBase() {
  return (
    process.env.ADMIN_API_URL ||
    process.env.REGNERWERK_ADMIN_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export async function loadTelephonyRuntime(): Promise<TelephonyRuntime> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    const secret = process.env.VOICE_GATEWAY_SECRET;
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
      headers["x-voice-gateway-key"] = secret;
    }
    const res = await fetch(`${adminBase()}/api/ai/telephony/runtime`, {
      headers,
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = (await res.json()) as TelephonyRuntime;
      const value: TelephonyRuntime = {
        pilotMode: data.pilotMode || "after_hours",
        transferOfficeE164:
          data.transferOfficeE164 ||
          process.env.TRANSFER_OFFICE_E164?.trim() ||
          process.env.TRANSFER_DEFAULT_E164?.trim() ||
          null,
        transferEmergencyE164:
          data.transferEmergencyE164 ||
          process.env.TRANSFER_EMERGENCY_E164?.trim() ||
          null,
        fallbackPolicy: data.fallbackPolicy || FALLBACK.fallbackPolicy,
        recordingEnabled: Boolean(data.recordingEnabled),
      };
      cache = { at: Date.now(), value };
      return value;
    }
  } catch (e) {
    console.warn("[telephony-runtime] fetch failed", e);
  }

  const value: TelephonyRuntime = {
    ...FALLBACK,
    transferOfficeE164:
      process.env.TRANSFER_OFFICE_E164?.trim() ||
      process.env.TRANSFER_DEFAULT_E164?.trim() ||
      null,
    transferEmergencyE164:
      process.env.TRANSFER_EMERGENCY_E164?.trim() || null,
  };
  cache = { at: Date.now(), value };
  return value;
}

export async function preloadTelephonyRuntime(): Promise<void> {
  await loadTelephonyRuntime();
}
