import { NextRequest, NextResponse } from "next/server";
import { getActivePromptRelease } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

/**
 * Internal: Voice Gateway loads the active production release.
 * Auth: Bearer VOICE_GATEWAY_SECRET (or open in local when secret unset).
 */
export async function GET(req: NextRequest) {
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
    const release = await getActivePromptRelease("production");
    if (!release) {
      return NextResponse.json({ release: null });
    }
    return NextResponse.json({
      release: {
        id: release.id,
        compiled: release.compiled_content,
        hash: release.compiled_hash,
        publishedAt: release.published_at,
        label: release.label,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
