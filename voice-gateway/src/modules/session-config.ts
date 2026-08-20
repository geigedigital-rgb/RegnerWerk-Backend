import type { RealtimeSessionOptions } from "@openai/agents/realtime";
import type { PublishedAssistant } from "./assistant.js";

/** Build Realtime session options from published assistant conversation knobs. */
export function buildSessionOptions(
  assistant: PublishedAssistant,
): Partial<RealtimeSessionOptions> {
  const { conversation } = assistant;
  const turnDetection =
    conversation.vadType === "server_vad"
      ? {
          type: "server_vad" as const,
          interruptResponse: conversation.interruptResponse,
          silenceDurationMs: conversation.silenceDurationMs,
          prefixPaddingMs: conversation.prefixPaddingMs,
        }
      : {
          type: "semantic_vad" as const,
          eagerness: conversation.vadEagerness,
          interruptResponse: conversation.interruptResponse,
        };

  return {
    model: assistant.model || "gpt-realtime",
    config: {
      audio: {
        input: {
          turnDetection,
          transcription: {
            model: "gpt-4o-mini-transcribe",
            language: "de",
          },
        },
        output: {
          voice: assistant.voice || "alloy",
        },
      },
    },
  };
}
