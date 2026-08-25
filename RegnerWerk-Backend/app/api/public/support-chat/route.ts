import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { corsPreflight, jsonError, withCors } from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getGeminiApiKey } from "@/lib/ai/gemini";
import {
  runSupportChat,
  supportChatRequestSchema,
} from "@/lib/ai/support-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/**
 * POST /api/public/support-chat
 * Website support widget → Gemini + published knowledge base.
 */
export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const rl = rateLimit(`public-support-chat:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) {
    return jsonError(req, 429, "Too many requests", { request_id: requestId });
  }

  if (!getGeminiApiKey()) {
    return jsonError(req, 503, "Support-Chat nicht konfiguriert", {
      request_id: requestId,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, 400, "Invalid JSON", { request_id: requestId });
  }

  const parsed = supportChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(req, 400, "Validation failed", {
      request_id: requestId,
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await runSupportChat(parsed.data);
    return withCors(
      req,
      NextResponse.json(
        {
          reply: result.reply,
          need_contact: result.need_contact,
          model: result.model,
          request_id: requestId,
          session_id: parsed.data.session_id ?? randomUUID(),
        },
        { status: 200 },
      ),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    console.error("[public/support-chat]", requestId, msg);
    return jsonError(req, 500, "Chat failed", { request_id: requestId });
  }
}
