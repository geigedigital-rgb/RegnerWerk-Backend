/**
 * Load published Empfang assistant config.
 * Order: Admin API → Supabase REST → local fallback.
 * (Prod gateway often has no Admin URL; Supabase is the source of truth.)
 */
export type ConversationConfig = {
  vadType: "semantic_vad" | "server_vad";
  vadEagerness: "auto" | "low" | "medium" | "high";
  interruptResponse: boolean;
  silenceDurationMs: number;
  prefixPaddingMs: number;
};

export type PublishedAssistant = {
  code: string;
  name: string;
  welcomeMessage: string | null;
  allowedTools: string[];
  model: string;
  voice: string;
  conversation: ConversationConfig;
  source: "admin" | "supabase" | "fallback";
};

const DEFAULT_CONVERSATION: ConversationConfig = {
  vadType: "semantic_vad",
  vadEagerness: "auto",
  interruptResponse: true,
  silenceDurationMs: 500,
  prefixPaddingMs: 300,
};

export const FALLBACK: PublishedAssistant = {
  code: "empfang",
  name: "RegnerWerk Empfang",
  welcomeMessage:
    "Guten Tag bei RegnerWerk. Sie sprechen mit unserem digitalen KI-Assistenten. Ich nehme Ihr Anliegen für unser Team auf. Möchten Sie, dass wir das Gespräch zur Bearbeitung aufzeichnen und transkribieren?",
  allowedTools: [
    "capture_recording_consent",
    "upsert_call_fact",
    "create_callback_task",
    "escalate_call",
    "finalize_call_outcome",
    "lookup_knowledge",
  ],
  model: "gpt-realtime",
  voice: "alloy",
  conversation: DEFAULT_CONVERSATION,
  source: "fallback",
};

function parseConversation(cfg: Record<string, unknown> | undefined): ConversationConfig {
  const c = cfg ?? {};
  const vadType =
    c.vad_type === "server_vad" ? "server_vad" : "semantic_vad";
  const eagerness = ["auto", "low", "medium", "high"].includes(
    String(c.vad_eagerness),
  )
    ? (String(c.vad_eagerness) as ConversationConfig["vadEagerness"])
    : "auto";
  return {
    vadType,
    vadEagerness: eagerness,
    interruptResponse:
      c.interrupt_response === undefined
        ? true
        : Boolean(c.interrupt_response),
    silenceDurationMs: Number(c.silence_duration_ms) || 500,
    prefixPaddingMs: Number(c.prefix_padding_ms) || 300,
  };
}

function fromConfigPayload(input: {
  code: string;
  name: string;
  welcomeMessage: string | null;
  allowedTools: string[];
  configuration?: Record<string, unknown>;
  source: PublishedAssistant["source"];
}): PublishedAssistant {
  const cfg = input.configuration ?? {};
  return {
    code: input.code,
    name: input.name || FALLBACK.name,
    welcomeMessage: input.welcomeMessage,
    allowedTools:
      input.allowedTools.length > 0
        ? input.allowedTools
        : FALLBACK.allowedTools,
    model: String(cfg.model || FALLBACK.model),
    voice: String(cfg.voice || FALLBACK.voice),
    conversation: parseConversation(cfg),
    source: input.source,
  };
}

async function loadFromAdmin(
  code: string,
): Promise<PublishedAssistant | null> {
  const adminUrl = (
    process.env.ADMIN_API_URL ||
    process.env.REGNERWERK_ADMIN_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
  const secret = process.env.VOICE_GATEWAY_SECRET;

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
      headers["x-voice-gateway-key"] = secret;
    }
    const res = await fetch(
      `${adminUrl}/api/ai/assistants/published?code=${encodeURIComponent(code)}`,
      { headers, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      assistant?: {
        code: string;
        name: string;
        welcomeMessage: string | null;
        allowedTools: string[];
        configuration?: Record<string, unknown>;
      } | null;
    };
    if (!data.assistant) return null;
    return fromConfigPayload({
      ...data.assistant,
      configuration: data.assistant.configuration,
      source: "admin",
    });
  } catch {
    return null;
  }
}

async function loadFromSupabase(
  code: string,
): Promise<PublishedAssistant | null> {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    "";
  if (!url || !key) return null;

  try {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    };
    const aRes = await fetch(
      `${url}/rest/v1/ai_assistants?code=eq.${encodeURIComponent(code)}&active=eq.true&select=id,code,name&limit=1`,
      { headers, signal: AbortSignal.timeout(4000) },
    );
    if (!aRes.ok) return null;
    const assistants = (await aRes.json()) as Array<{
      id: string;
      code: string;
      name: string;
    }>;
    const assistant = assistants[0];
    if (!assistant) return null;

    const vRes = await fetch(
      `${url}/rest/v1/ai_assistant_versions?assistant_id=eq.${assistant.id}&select=status,configuration,version&order=version.desc&limit=10`,
      { headers, signal: AbortSignal.timeout(4000) },
    );
    if (!vRes.ok) return null;
    const versions = (await vRes.json()) as Array<{
      status: string;
      configuration: Record<string, unknown>;
      version: number;
    }>;
    const ver =
      versions.find((v) => v.status === "published") ?? versions[0] ?? null;
    if (!ver) return null;

    const cfg = ver.configuration ?? {};
    const policyCode = String(cfg.tool_policy_code || "empfang_default");

    // Resolve tool allowlist from published policy
    let allowedTools = FALLBACK.allowedTools;
    const pRes = await fetch(
      `${url}/rest/v1/tool_policies?code=eq.${encodeURIComponent(policyCode)}&select=id&limit=1`,
      { headers, signal: AbortSignal.timeout(4000) },
    );
    if (pRes.ok) {
      const policies = (await pRes.json()) as Array<{ id: string }>;
      const policyId = policies[0]?.id;
      if (policyId) {
        const tvRes = await fetch(
          `${url}/rest/v1/tool_policy_versions?tool_policy_id=eq.${policyId}&status=eq.published&select=tools&order=version.desc&limit=1`,
          { headers, signal: AbortSignal.timeout(4000) },
        );
        if (tvRes.ok) {
          const tvs = (await tvRes.json()) as Array<{
            tools: Array<{ tool_name: string; autonomy: string }>;
          }>;
          const tools = tvs[0]?.tools;
          if (Array.isArray(tools) && tools.length) {
            allowedTools = tools
              .filter((t) => t.autonomy !== "deny")
              .map((t) => t.tool_name);
          }
        }
      }
    }

    return fromConfigPayload({
      code: assistant.code,
      name: assistant.name,
      welcomeMessage:
        typeof cfg.welcome_message === "string" ? cfg.welcome_message : null,
      allowedTools,
      configuration: cfg,
      source: "supabase",
    });
  } catch (e) {
    console.warn("[assistant] supabase load failed", e);
    return null;
  }
}

export async function loadPublishedAssistant(
  code = "empfang",
): Promise<PublishedAssistant> {
  const fromAdmin = await loadFromAdmin(code);
  if (fromAdmin) return fromAdmin;
  const fromSb = await loadFromSupabase(code);
  if (fromSb) return fromSb;
  return FALLBACK;
}
