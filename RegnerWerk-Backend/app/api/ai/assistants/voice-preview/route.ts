import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

/** Proxy TTS preview to voice-gateway (holds OPENAI_API_KEY). */
export async function GET(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;

  const voiceRaw = req.nextUrl.searchParams.get("voice")?.trim() || "alloy";
  const voice = ALLOWED.has(voiceRaw) ? voiceRaw : "alloy";

  const gatewayUrl =
    process.env.VOICE_GATEWAY_URL?.replace(/\/$/, "") ||
    "http://localhost:8000";
  const secret = process.env.VOICE_GATEWAY_SECRET?.trim();

  try {
    const headers: Record<string, string> = { Accept: "audio/mpeg" };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
      headers["x-voice-gateway-key"] = secret;
    }
    const res = await fetch(
      `${gatewayUrl}/preview/voice?voice=${encodeURIComponent(voice)}`,
      {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Preview fehlgeschlagen",
          detail: detail.slice(0, 400),
        },
        { status: res.status === 401 ? 502 : 502 },
      );
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Voice Gateway nicht erreichbar",
      },
      { status: 502 },
    );
  }
}
