/**
 * Lookup contact by E.164 phone via Admin API (TZ LINK-001).
 * Never disclose private CRM facts until identity check.
 */
export type CrmMatch =
  | { status: "none" }
  | {
      status: "single";
      contactId: string;
      displayName?: string;
      customerStatus?: string;
    }
  | {
      status: "ambiguous";
      contactIds: string[];
      candidates?: Array<{ contactId: string; displayName?: string }>;
    };

function adminBase() {
  return (
    process.env.ADMIN_API_URL ||
    process.env.REGNERWERK_ADMIN_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

function gatewayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const secret = process.env.VOICE_GATEWAY_SECRET;
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["x-voice-gateway-key"] = secret;
  }
  return headers;
}

export async function lookupByPhone(e164: string | null): Promise<CrmMatch> {
  if (!e164) return { status: "none" };

  try {
    const res = await fetch(
      `${adminBase()}/api/ai/crm/lookup?phone=${encodeURIComponent(e164)}`,
      { headers: gatewayHeaders(), signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) {
      console.warn("[crm-lookup] admin lookup failed", res.status);
      return { status: "none" };
    }
    const data = (await res.json()) as CrmMatch;
    console.info("[crm-lookup]", data.status, e164);
    return data;
  } catch (e) {
    console.warn("[crm-lookup] error", e);
    return { status: "none" };
  }
}
