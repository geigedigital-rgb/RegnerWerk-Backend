/**
 * Load published Empfang assistant config from Admin (TZ §8.2).
 */
export type PublishedAssistant = {
  code: string;
  name: string;
  welcomeMessage: string | null;
  allowedTools: string[];
  model?: string;
  voice?: string;
};

const FALLBACK: PublishedAssistant = {
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
  ],
  model: "gpt-realtime",
  voice: "alloy",
};

export async function loadPublishedAssistant(
  code = "empfang",
): Promise<PublishedAssistant> {
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
    if (!res.ok) return FALLBACK;
    const data = (await res.json()) as {
      assistant?: {
        code: string;
        name: string;
        welcomeMessage: string | null;
        allowedTools: string[];
        configuration?: { model?: string; voice?: string };
      } | null;
    };
    if (!data.assistant) return FALLBACK;
    return {
      code: data.assistant.code,
      name: data.assistant.name,
      welcomeMessage: data.assistant.welcomeMessage,
      allowedTools: data.assistant.allowedTools ?? FALLBACK.allowedTools,
      model: data.assistant.configuration?.model,
      voice: data.assistant.configuration?.voice,
    };
  } catch {
    return FALLBACK;
  }
}
