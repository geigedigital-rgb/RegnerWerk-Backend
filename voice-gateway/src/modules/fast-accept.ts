/**
 * SIP accept body — G.711 PCMU (telephony). Wrong format → OpenAI answers then BYE → silence on PSTN.
 */

export type SlimAcceptBody = {
  type: "realtime";
  model: string;
  instructions: string;
  output_modalities: Array<"audio">;
  audio: {
    input: {
      format: { type: "audio/pcmu" };
      turn_detection: { type: "semantic_vad" | "server_vad" };
      transcription: {
        model: string;
        language: string;
      };
    };
    output: {
      format: { type: "audio/pcmu" };
      voice: string;
    };
  };
};

export function buildSlimAcceptBody(opts: {
  model: string;
  voice: string;
  instructions: string;
  welcome: string;
}): SlimAcceptBody {
  const welcome = opts.welcome.trim() || "Guten Tag bei RegnerWerk.";
  const base = opts.instructions.slice(0, 3500);
  return {
    type: "realtime",
    model: opts.model || "gpt-realtime",
    output_modalities: ["audio"],
    instructions: `${base}

WICHTIG: Sofort nach Verbindungsaufbau begrüße den Anrufer genau mit: '${welcome}'
Dann warte auf die Antwort. Sprich auf Deutsch.
Wenn der Anrufer sich verabschiedet (Tschüss, Ciao, Auf Wiedersehen, Bye): antworte kurz freundlich und beende — keine neuen Fragen.`,
    audio: {
      input: {
        format: { type: "audio/pcmu" },
        turn_detection: { type: "semantic_vad" },
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "de",
        },
      },
      output: {
        format: { type: "audio/pcmu" },
        voice: opts.voice || "alloy",
      },
    },
  };
}

export async function acceptRealtimeCallRaw(
  callId: string,
  body: SlimAcceptBody,
  apiKey: string,
): Promise<{ ok: true; ms: number } | { ok: false; status: number; text: string; ms: number }> {
  const t0 = Date.now();
  // GA Realtime session shape — do NOT send OpenAI-Beta: realtime=v1 (mismatches SIP audio).
  const res = await fetch(
    `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/accept`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    },
  );
  const ms = Date.now() - t0;
  if (res.ok) return { ok: true, ms };
  const text = await res.text().catch(() => "");
  return { ok: false, status: res.status, text: text.slice(0, 500), ms };
}

export async function warmOpenAiApi(apiKey: string): Promise<void> {
  await fetch("https://api.openai.com/v1/models?limit=1", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}
