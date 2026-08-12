/**
 * Load published prompt release for RegnerWerk Empfang (TZ §13).
 * Prefers Admin Prompt Studio active release; falls back to local draft.
 */
export type PromptRelease = {
  id: string;
  compiled: string;
  hash: string;
};

const DRAFT_PROMPT = `Du bist der digitale KI-Assistent von RegnerWerk (Automatische Gartenbewässerung, Deutschland).
Sprich ruhig, klar und kurz auf Deutsch.
Offenbare, dass du ein KI-Assistent bist.
Versprich keine Festpreise und keine Montagetermine.
Bei Bitte um einen Mitarbeiter: Qualifikation stoppen und Transfer vorbereiten.`;

export async function loadPublishedPromptRelease(): Promise<PromptRelease> {
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
    const res = await fetch(`${adminUrl}/api/ai/prompts/published`, {
      headers,
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        release?: { id: string; compiled: string; hash: string } | null;
      };
      if (data.release?.compiled) {
        return {
          id: data.release.id,
          compiled: data.release.compiled,
          hash: data.release.hash,
        };
      }
    }
  } catch {
    /* fall through to local draft */
  }

  return {
    id: "draft-local",
    compiled: DRAFT_PROMPT,
    hash: "local-dev",
  };
}
