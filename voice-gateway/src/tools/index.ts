import { tool } from "@openai/agents/realtime";
import { z } from "zod";
import { saveCallFact } from "../modules/supabase.js";
import { selectTransferTarget } from "../modules/transfer.js";

/**
 * Allowlisted AI tools (TZ §30.8) — stubs only in this slice.
 */

export const captureRecordingConsent = tool({
  name: "capture_recording_consent",
  description:
    "Speichert die Antwort des Anrufers zur Aufnahme/Transkription. Startet die Aufnahme nur bei Zustimmung.",
  parameters: z.object({
    granted: z.boolean().describe("true wenn der Anrufer zugestimmt hat"),
    noticeVersion: z.string().default("draft-2026-08"),
  }),
  execute: async ({ granted, noticeVersion }) => {
    console.info("[tool] capture_recording_consent", { granted, noticeVersion });
    return granted
      ? "Consent granted — recording may start (stub)."
      : "Consent denied — no recording, no persistent transcript.";
  },
});

export const upsertCallFact = tool({
  name: "upsert_call_fact",
  description: "Speichert einen bestätigten oder vorgeschlagenen Fakt aus dem Gespräch.",
  parameters: z.object({
    callId: z.string(),
    fieldKey: z.string(),
    value: z.string(),
    confirmed: z.boolean().default(false),
  }),
  execute: async ({ callId, fieldKey, value, confirmed }) => {
    await saveCallFact({
      callId,
      fieldKey,
      value: { text: value, confirmed },
      confidence: confirmed ? 1 : 0.6,
    });
    return `Fact ${fieldKey} stored as ${confirmed ? "confirmed" : "proposed"}.`;
  },
});

export const createCallbackTask = tool({
  name: "create_callback_task",
  description: "Erstellt eine Rückruf-Aufgabe für das Büro.",
  parameters: z.object({
    window: z.string().describe("Gewünschtes Zeitfenster"),
    summary: z.string(),
  }),
  execute: async ({ window, summary }) => {
    console.info("[tool] create_callback_task stub", { window, summary });
    return "Callback task draft created (stub).";
  },
});

export const escalateCall = tool({
  name: "escalate_call",
  description: "Eskaliert den Anruf an einen Menschen. Zielnummer wählt der Server.",
  parameters: z.object({
    reason: z.enum([
      "human_request",
      "emergency_water",
      "legal_or_privacy",
      "complaint",
      "other",
    ]),
  }),
  execute: async ({ reason }) => {
    const target = await selectTransferTarget(reason);
    console.info("[tool] escalate_call", { reason, target });
    if (!target) {
      return "Kein Transferziel konfiguriert — Priority-Callback wird erstellt (stub).";
    }
    return `Transfer vorbereitet an ${target.label} (${target.e164}).`;
  },
});

export const finalizeCallOutcome = tool({
  name: "finalize_call_outcome",
  description: "Schließt den Anruf mit einem zulässigen Outcome ab.",
  parameters: z.object({
    outcome: z.enum([
      "qualified_lead",
      "callback_scheduled",
      "transferred",
      "info_only",
      "spam_candidate",
      "disconnected",
    ]),
    summary: z.string(),
  }),
  execute: async ({ outcome, summary }) => {
    console.info("[tool] finalize_call_outcome stub", { outcome, summary });
    return `Outcome ${outcome} recorded.`;
  },
});

export const receptionTools = [
  captureRecordingConsent,
  upsertCallFact,
  createCallbackTask,
  escalateCall,
  finalizeCallOutcome,
];
