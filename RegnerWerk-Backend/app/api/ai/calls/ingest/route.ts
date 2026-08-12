import { NextRequest, NextResponse } from "next/server";
import { ingestCallEvent } from "@/lib/ai/calls";

export const dynamic = "force-dynamic";

/** Internal: Voice Gateway call lifecycle ingest. */
export async function POST(req: NextRequest) {
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
    const body = (await req.json()) as {
      openaiCallId?: string;
      event?:
        | "incoming"
        | "accepted"
        | "in_progress"
        | "ended"
        | "failed"
        | "transferring";
      fromNumber?: string | null;
      toNumber?: string | null;
      outcome?: string | null;
      summary?: string | null;
      errorCode?: string | null;
      assistantCode?: string | null;
      model?: string | null;
      aiMode?: string | null;
      metadata?: Record<string, unknown>;
    };
    if (!body.openaiCallId || !body.event) {
      return NextResponse.json(
        { error: "openaiCallId und event erforderlich" },
        { status: 400 },
      );
    }
    const call = await ingestCallEvent({
      openaiCallId: body.openaiCallId,
      event: body.event,
      fromNumber: body.fromNumber,
      toNumber: body.toNumber,
      outcome: body.outcome,
      summary: body.summary,
      errorCode: body.errorCode,
      assistantCode: body.assistantCode,
      model: body.model,
      aiMode: body.aiMode,
      metadata: body.metadata,
    });
    return NextResponse.json({ call }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
