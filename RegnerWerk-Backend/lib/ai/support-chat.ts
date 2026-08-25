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
- Kurze Antworten: 2–4 Sätze, max. ~60 Wörter. Eine klare nächste Frage.
- Deutsch, ruhig, konkret.

Was du NICHT darfst, solange du den Bedarf nicht kennst:
- Keine Produkt-/Paket-Empfehlung, keinen Konfigurator, keinen Rückruf, kein Angebot vorschlagen.
- Keine URLs/Links (auch nicht konfigurator.regnerwerk.de), außer der Besucher fragt ausdrücklich danach oder hat schon klar gesagt, dass er selbst planen/bestellen will.
- Keine Festpreise, Termine, Garantien, Einzugsgebiete erfinden.

Gesprächsablauf:
1. Beantworte die gestellte Frage knapp aus der Wissensbasis.
2. Wenn Garten, Ziel oder Ausgangslage unklar sind: stelle EINE Frage (z. B. Rasen/Beete, Neubau oder bestehende Anlage, grobe Fläche, Wasserquelle, PLZ, was er wissen möchte).
3. Erst wenn genug Kontext da ist UND der Besucher selbst plant/bestellen/konfigurieren will: dann darfst du den Sofort-Konfigurator nennen (https://konfigurator.regnerwerk.de) — mit einem Satz warum er passt.
4. Preise: erkläre kurz, WARUM im Chat kein Festpreis geht (Fläche, Wasser, Aufwand). Dann eine Verständnisfrage, kein Formular.
5. Handoff-Markierung nur in diesen Fällen:
   - [[HANDOFF:price]] wenn der Besucher trotz Erklärung weiter einen konkreten Preis/Angebot will.
   - [[HANDOFF:uncertain]] wenn nach 1–2 Rückfragen die Wissensbasis wirklich nicht reicht.
   - [[HANDOFF:request]] wenn er EXPLIZIT Rückruf/Mensch/Kontakt will.
6. Normale Info-Fragen: keine Markierung, keine Links, keine Angebote.

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

function stripHandoff(text: string): {
  reply: string;
  needContact: boolean;
  reason: HandoffReason | null;
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
  const needContact = matches.length > 0;
  const reply = text
    .replace(HANDOFF_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { reply, needContact, reason };
}

export async function runSupportChat(
  input: SupportChatRequest,
): Promise<{
  reply: string;
  need_contact: boolean;
  handoff_reason: HandoffReason | null;
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

  const parsed = stripHandoff(raw);
  const reason =
    parsed.reason ??
    (parsed.needContact ? inferReasonFromUser(lastUser) ?? "uncertain" : null);

  return {
    reply:
      parsed.reply ||
      "Dazu brauche ich kurz das Fachteam — ich erkläre gerne den nächsten Schritt.",
    need_contact: parsed.needContact,
    handoff_reason: reason,
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
