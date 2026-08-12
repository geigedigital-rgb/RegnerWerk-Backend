import { NextRequest, NextResponse } from "next/server";

/** Shared gate for Voice Gateway → Admin internal APIs. */
export function assertVoiceGatewayAuth(req: Request | NextRequest): NextResponse | null {
  const secret = process.env.VOICE_GATEWAY_SECRET;
  if (!secret) return null; // local open
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const headerKey = req.headers.get("x-voice-gateway-key") ?? "";
  if (token !== secret && headerKey !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
