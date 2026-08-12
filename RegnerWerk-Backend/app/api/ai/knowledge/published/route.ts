import { NextResponse } from "next/server";
import { listPublishedKnowledgeForGateway } from "@/lib/ai/knowledge";

export const dynamic = "force-dynamic";

/** Internal: Voice Gateway / tools — published articles only. */
export async function GET(req: Request) {
  const secret = process.env.VOICE_GATEWAY_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const headerKey = req.headers.get("x-voice-gateway-key") ?? "";
    if (token !== secret && headerKey !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const articles = await listPublishedKnowledgeForGateway();
    return NextResponse.json({ articles });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
