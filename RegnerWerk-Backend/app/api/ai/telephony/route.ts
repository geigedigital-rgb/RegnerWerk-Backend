import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getTelephonySettings, updateTelephonySetting } from "@/lib/ai/calls";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) {
    const owner = await requireApiUser("calls.read");
    if (owner.error) return owner.error;
  }
  try {
    const settings = await getTelephonySettings();
    const gatewayUrl =
      process.env.VOICE_GATEWAY_URL?.replace(/\/$/, "") ||
      "http://localhost:8000";
    let gateway: Record<string, unknown> = { status: "offline" };
    try {
      const res = await fetch(`${gatewayUrl}/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      gateway = await res.json();
      gateway.httpStatus = res.status;
    } catch {
      gateway = { status: "offline" };
    }
    return NextResponse.json({ settings, gateway });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.publish");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as { key?: string; value?: unknown };
    if (!body.key) {
      return NextResponse.json({ error: "key erforderlich" }, { status: 400 });
    }
    await updateTelephonySetting(body.key, body.value);
    const settings = await getTelephonySettings();
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
