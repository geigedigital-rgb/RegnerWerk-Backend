import { z } from "zod";
import {
  generateGeminiText,
  getGeminiModel,
  type GeminiMessage,
} from "@/lib/ai/gemini";
import { listPublishedKnowledgeForGateway } from "@/lib/ai/knowledge";

export const supportChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

export const supportChatRequestSchema = z.object({
  messages: z.array(supportChatMessageSchema).min(1).max(24),
  session_id: z.string().uuid().optional().nullable(),
  landing_page: z.string().trim().max(500).optional().nullable(),
});

export type SupportChatRequest = z.infer<typeof supportChatRequestSchema>;

export type HandoffReason = "price" | "uncertain" | "request";

const HANDOFF_RE =
  /\[\[HANDOFF(?::(price|uncertain|request))?\]\]/gi;
const CONFIGURATOR_RE = /\[\[CONFIGURATOR\]\]/gi;
const URL_RE =
  /https?:\/\/\S+|www\.\S+|konfigurator\.regnerwerk\.de\S*/gi;

function buildKnowledgeBlock(
  articles: Array<{
    title: string;
    category: string;
    content: string;
    sensitivity: string;
  }>,
): string {
  const usable = articles.filter((a) => a.sensitivity !== "internal");
  if (usable.length === 0) {
    return "(Keine veröffentlichten Wissensartikel.)";
  }
  return usable
    .slice(0, 40)
    .map((a) => {
      const body = a.content.trim().slice(0, 900);
      return `### ${a.title} [${a.category}]\n${body}`;
    })
    .join("\n\n");
}

function buildSystemPrompt(knowledge: string): string {
  return `Du bist der Website-Support-Assistent von RegnerWerk (automatische Gartenbewässerung, Deutschland).

Gesprächsstil:
- Zuerst zuhören und nachfragen. Nicht verkaufen, nicht drängen.
- Kurze Antworten: 2–4 Sätze, max. ~55 Wörter. Höchstens EINE nächste Frage.
- Deutsch, ruhig, konkret.

Fragen im Chat — erlaubt:
- Was der Besucher will (Neuanlage, Reparatur, Info…)
- Gartenbild: Rasen, Beete, gemischt
- grobe Fläche in m²
- neu oder bestehende Anlage

Fragen im Chat — VERBOTEN (nur später im Kontaktformular):
- PLZ, Ort, Adresse, Region, Einzugsgebiet
- Wasserquelle, Brunnen, Außenwasserhahn, Leitungsdruck
- Telefon, E-Mail, Name (außer er fragt selbst nach Rückruf)

Was du NICHT darfst, solange der Bedarf unklar ist:
- Keinen Konfigurator, keinen Rückruf, kein Angebot vorschlagen.
- Niemals URLs oder Domain-Namen schreiben (auch nicht konfigurator.regnerwerk.de).

Gesprächsablauf:
1. Frage knapp beantworten.
2. Bei unklarem Bedarf: EINE erlaubte Frage (Ziel / Rasen-Beete / Fläche / neu vs. bestehend).
3. Konfigurator erst, wenn der Besucher klar planen, bestellen oder selbst konfigurieren will UND du grob weißt, worum es geht (z. B. Neuanlage + Rasen/Fläche). Dann:
   - kurzer Satz ohne Link
   - in einer eigenen Zeile genau: [[CONFIGURATOR]]
   - Die Website zeigt dann eine Schaltfläche — du schreibst keine Links.
4. Preise: kurz erklären, dass Festpreise erst nach Prüfung gehen (Fläche/Aufwand). Keine PLZ/Wasser-Fragen. Dann Verständnisfrage zum Garten.
5. Handoff-Markierung nur:
   - [[HANDOFF:price]] wenn er trotz Erklärung einen konkreten Preis/Angebot will
   - [[HANDOFF:uncertain]] nach 1–2 erlaubten Rückfragen, wenn die Wissensbasis nicht reicht
   - [[HANDOFF:request]] bei explizitem Rückruf/Mensch/Kontakt
6. Normale Info: keine Markierung, kein Konfigurator.

## Wissensbasis
${knowledge}`;
}

function inferReasonFromUser(
  lastUser: string | undefined,
): HandoffReason | null {
  if (!lastUser) return null;
  const t = lastUser.toLowerCase();
  if (
    /preis|kostet|kosten|angebot|€|euro|günstig|teuer|budget|wie viel/.test(t)
  ) {
    return "price";
  }
  if (
    /rückruf|anrufen|mensch|mitarbeiter|berater|kontakt|anruf|telefonieren/.test(
      t,
    )
  ) {
    return "request";
  }
  return null;
}

function parseAssistantText(text: string): {
  reply: string;
  needContact: boolean;
  reason: HandoffReason | null;
  showConfigurator: boolean;
} {
  let reason: HandoffReason | null = null;
  const matches = [...text.matchAll(HANDOFF_RE)];
  for (const m of matches) {
    const tagged = (m[1] || "").toLowerCase();
    if (tagged === "price" || tagged === "uncertain" || tagged === "request") {
      reason = tagged;
    } else {
      reason = reason ?? "uncertain";
    }
  }
  const showConfigurator =
    /\[\[CONFIGURATOR\]\]/i.test(text) ||
    /konfigurator\.regnerwerk\.de|\/konfigurator/i.test(text);

  const reply = text
    .replace(HANDOFF_RE, "")
    .replace(CONFIGURATOR_RE, "")
    .replace(URL_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return {
    reply,
    needContact: matches.length > 0,
    reason,
    showConfigurator,
  };
}

export async function runSupportChat(
  input: SupportChatRequest,
): Promise<{
  reply: string;
  need_contact: boolean;
  handoff_reason: HandoffReason | null;
  show_configurator: boolean;
  model: string;
}> {
  const articles = await listPublishedKnowledgeForGateway();
  const system = buildSystemPrompt(buildKnowledgeBlock(articles));

  const geminiMessages: GeminiMessage[] = input.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    text: m.content,
  }));

  const lastUser = [...input.messages].reverse().find((m) => m.role === "user")
    ?.content;

  const raw = await generateGeminiText({
    system,
    messages: geminiMessages,
    temperature: 0.3,
    maxOutputTokens: 280,
  });

  const parsed = parseAssistantText(raw);
  const reason =
    parsed.reason ??
    (parsed.needContact ? inferReasonFromUser(lastUser) ?? "uncertain" : null);

  return {
    reply:
      parsed.reply ||
      "Dazu brauche ich kurz das Fachteam — ich erkläre gerne den nächsten Schritt.",
    need_contact: parsed.needContact,
    handoff_reason: reason,
    show_configurator: parsed.showConfigurator,
    model: getGeminiModel(),
  };
}

export function formatTranscript(
  messages: Array<{ role: string; content: string }>,
): string {
  return messages
    .map(
      (m) =>
        `${m.role === "assistant" ? "Assistent" : "Besucher"}: ${m.content}`,
    )
    .join("\n")
    .slice(0, 3800);
}
