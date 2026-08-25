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

Ziel: Zuerst hilfreich informieren. Formulare und Rückrufe sind Ausnahme, nicht Standard.

Regeln:
- Antworte auf Deutsch, klar und freundlich (ca. 40–90 Wörter).
- Beantworte die Frage so gut wie möglich aus der Wissensbasis — auch bei Preisen/Terminen: erkläre den Ablauf und was das Team braucht, ohne Festpreise oder Termine zuzusagen.
- Du bist eine KI — nur sagen, wenn danach gefragt wird.
- Erfinde keine Preise, Termine, Garantien oder Einzugsgebiete.
- Links nur: konfigurator.regnerwerk.de wenn passend.
- ${HANDOFF_MARKER} NUR setzen, wenn der Besucher EXPLIZIT einen Menschen, Rückruf, Angebot oder Kontakt hinterlassen will — oder klar sagt, dass die Antwort nicht reicht und er angerufen werden möchte.
- Bei normalen FAQ/Info-Fragen NIEMALS ${HANDOFF_MARKER} setzen und KEINE Formulare fordern.
- Ohne ${HANDOFF_MARKER} darfst du optional kurz erwähnen, dass ein Rückruf möglich ist — aber nicht drängen.

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
