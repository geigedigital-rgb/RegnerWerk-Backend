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

const HANDOFF_MARKER = "[[HANDOFF]]";

function buildKnowledgeBlock(
  articles: Array<{ title: string; category: string; content: string; sensitivity: string }>,
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

Regeln:
- Antworte auf Deutsch, kurz und freundlich (max. ~80 Wörter).
- Du bist eine KI — sage das offen, wenn gefragt.
- Nutze NUR die Wissensbasis unten. Erfinde keine Preise, Termine, Garantien oder Einzugsgebiete.
- Keine Festpreise. Bei Preis-/Termin-/Objektfragen: Rückruf anbieten.
- Wenn du nicht sicher bist ODER der Besucher einen Menschen / Rückruf / Angebot will: sage das klar und beende mit genau dieser Markierung in einer eigenen Zeile: ${HANDOFF_MARKER}
- Keine Links außer konfigurator.regnerwerk.de wenn passend.
- Keine internen oder rechtlichen Details außer freigegebenen Legal-Hinweisen.

## Wissensbasis
${knowledge}`;
}

function stripHandoff(text: string): { reply: string; needContact: boolean } {
  const needContact = text.includes(HANDOFF_MARKER);
  const reply = text
    .split(HANDOFF_MARKER)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { reply, needContact };
}

export async function runSupportChat(
  input: SupportChatRequest,
): Promise<{ reply: string; need_contact: boolean; model: string }> {
  const articles = await listPublishedKnowledgeForGateway();
  const system = buildSystemPrompt(buildKnowledgeBlock(articles));

  const geminiMessages: GeminiMessage[] = input.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    text: m.content,
  }));

  const raw = await generateGeminiText({
    system,
    messages: geminiMessages,
    temperature: 0.3,
    maxOutputTokens: 400,
  });

  const { reply, needContact } = stripHandoff(raw);

  return {
    reply:
      reply ||
      "Gerne helfe ich weiter — oder hinterlassen Sie kurz Ihre Kontaktdaten für einen Rückruf.",
    need_contact: needContact,
    model: getGeminiModel(),
  };
}

export function formatTranscript(
  messages: Array<{ role: string; content: string }>,
): string {
  return messages
    .map((m) => `${m.role === "assistant" ? "Assistent" : "Besucher"}: ${m.content}`)
    .join("\n")
    .slice(0, 3800);
}
