/**
 * Minimal Gemini REST client — cheapest model by default.
 * Key: GEMINI_API_KEY (server-only). Optional: GEMINI_MODEL.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export type GeminiMessage = {
  role: "user" | "model";
  text: string;
};

type GenerateOpts = {
  system: string;
  messages: GeminiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
};

export function getGeminiModel(): string {
  return (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL).trim();
}

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

export async function generateGeminiText(opts: GenerateOpts): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY fehlt");
  }

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const contents = opts.messages
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role,
      parts: [{ text: m.text.slice(0, 4000) }],
    }));

  if (contents.length === 0) {
    throw new Error("Keine Nachrichten");
  }

  const body = {
    systemInstruction: {
      parts: [{ text: opts.system.slice(0, 30_000) }],
    },
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.35,
      maxOutputTokens: opts.maxOutputTokens ?? 512,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  if (!res.ok) {
    const msg = data.error?.message || `Gemini HTTP ${res.status}`;
    throw new Error(msg);
  }

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    throw new Error("Leere Antwort von Gemini");
  }

  return text;
}
