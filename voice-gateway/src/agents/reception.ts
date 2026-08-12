import { RECOMMENDED_PROMPT_PREFIX } from "@openai/agents-core/extensions";
import { RealtimeAgent } from "@openai/agents/realtime";
import { receptionTools } from "../tools/index.js";
import { loadPublishedPromptRelease } from "../modules/prompts.js";
import { loadPublishedAssistant } from "../modules/assistant.js";

/** Draft greeting — final legal wording approved separately (TZ §15.4). */
export const WELCOME_MESSAGE =
  "Guten Tag bei RegnerWerk. Sie sprechen mit unserem digitalen KI-Assistenten. Ich nehme Ihr Anliegen für unser Team auf. Möchten Sie, dass wir das Gespräch zur Bearbeitung aufzeichnen und transkribieren?";

function toolName(t: unknown): string | undefined {
  return (t as { name?: string }).name;
}

function filterTools(allowed: string[]) {
  const set = new Set(allowed);
  return receptionTools.filter((t) => {
    const name = toolName(t);
    return name ? set.has(name) : false;
  });
}

export async function resolveWelcomeMessage(): Promise<string> {
  const assistant = await loadPublishedAssistant("empfang");
  return assistant.welcomeMessage?.trim() || WELCOME_MESSAGE;
}

export async function getStartingAgent(): Promise<RealtimeAgent> {
  const [prompt, assistant] = await Promise.all([
    loadPublishedPromptRelease(),
    loadPublishedAssistant("empfang"),
  ]);

  const welcome = assistant.welcomeMessage?.trim() || WELCOME_MESSAGE;
  const tools = filterTools(assistant.allowedTools);
  const effectiveTools =
    tools.length > 0
      ? tools
      : receptionTools.filter((t) => {
          const name = toolName(t);
          return (
            name === "capture_recording_consent" ||
            name === "escalate_call" ||
            name === "finalize_call_outcome"
          );
        });

  const repairAgent = new RealtimeAgent({
    name: "Reparatur",
    handoffDescription:
      "Triage für Reparatur, Leckage und Störungen bestehender Anlagen.",
    instructions: `${RECOMMENDED_PROMPT_PREFIX}
Du hilfst bei Reparatur-Anliegen. Frage nach Symptomen, Wasserschaden und ob die Wasserzufuhr abgestellt werden kann.
Bei Rohrbruch/Wasserschaden: sofort escalate_call mit emergency_water.
Keine Preise, keine Montagetermine.`,
    tools: effectiveTools,
  });

  const newInstallAgent = new RealtimeAgent({
    name: "Neuanlage",
    handoffDescription: "Qualifikation für neue Bewässerungsanlagen.",
    instructions: `${RECOMMENDED_PROMPT_PREFIX}
Du qualifizierst neue Anlagen. Sammle nur relevante Felder: Name, PLZ, ungefähre Fläche, Wasserquelle, Rückrufwunsch.
Ein Frage nach der anderen. Keine Festpreise, keine Termine.`,
    tools: effectiveTools,
  });

  const humanRequestAgent = new RealtimeAgent({
    name: "Mensch",
    handoffDescription: "Anrufer möchte einen Mitarbeiter sprechen.",
    instructions: `${RECOMMENDED_PROMPT_PREFIX}
Der Anrufer möchte einen Menschen. Stoppe die Qualifikation.
Bestätige kurz und rufe escalate_call mit human_request auf.
Versprich keine Verbindung, wenn Transfer nicht bestätigt ist.`,
    tools: effectiveTools,
  });

  const triageAgent = new RealtimeAgent({
    name: assistant.name || "RegnerWerk Empfang",
    handoffDescription: "Erster Kontakt, Intent-Erkennung und Routing.",
    instructions: `${RECOMMENDED_PROMPT_PREFIX}
${prompt.compiled}

Beginne mit genau: '${welcome}'
Danach Intent erkennen und bei Bedarf an Reparatur, Neuanlage oder Mensch übergeben.
Nutze nur die erlaubten Tools.`,
    tools: effectiveTools,
    handoffs: [repairAgent, newInstallAgent, humanRequestAgent],
  });

  repairAgent.handoffs = [triageAgent, humanRequestAgent];
  newInstallAgent.handoffs = [triageAgent, humanRequestAgent];
  humanRequestAgent.handoffs = [triageAgent];

  return triageAgent;
}
