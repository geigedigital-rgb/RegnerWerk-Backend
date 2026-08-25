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

Ablauf bei schwierigen Themen (Preise / Unsicherheit):
1. Zuerst sachlich antworten und erklären.
2. Klar sagen, WARUM du keine verbindliche Zusage machen kannst.
3. Dann anbieten, dass das Fachteam nach kurzer Kontaktaufnahme weiterhelfen kann.
4. Erst danach die Markierung setzen (siehe unten). Nie nur die Markierung ohne Erklärung.

Regeln:
- Antworte auf Deutsch, klar und freundlich (ca. 40–100 Wörter).
- Du bist eine KI — nur erwähnen, wenn danach gefragt wird.
- Nutze die Wissensbasis. Erfinde keine Preise, Termine, Garantien oder Einzugsgebiete.
- Links nur: konfigurator.regnerwerk.de wenn passend.
- Normale FAQ/Info: antworten, KEINE Handoff-Markierung.
- Bei Preis-/Kostenfragen: erklären, dass Preise von Fläche, Wasser und Aufwand abhängen und erst nach Prüfung ein Angebot kommt — dann Markierung [[HANDOFF:price]] in einer eigenen Zeile.
- Wenn die Wissensbasis nicht reicht oder du unsicher bist: ehrlich sagen, was unklar ist — dann Markierung [[HANDOFF:uncertain]].
- Wenn der Besucher EXPLIZIT Rückruf / Mensch / Kontakt will: kurz bestätigen — dann [[HANDOFF:request]].
- Keine andere Handoff-Syntax verwenden.

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
    maxOutputTokens: 450,
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
