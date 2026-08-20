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
      if (!("status" in gateway)) gateway.status = res.ok ? "ok" : "error";
    } catch {
      gateway = { status: "offline" };
    }

    const publicGateway =
      process.env.NEXT_PUBLIC_VOICE_GATEWAY_URL?.replace(/\/$/, "") ||
      (gatewayUrl.includes("localhost")
        ? "https://regnerwerk-backend-production.up.railway.app"
        : gatewayUrl);

    const connections = {
      gatewayOnline: gateway.status === "ok",
      openai: Boolean(gateway.openaiConfigured),
      openaiSip: Boolean(gateway.openaiSipConfigured),
      telnyx: Boolean(gateway.telnyxConfigured),
      telnyxPhone:
        (typeof gateway.telnyxPhone === "string" && gateway.telnyxPhone) ||
        asSettingString(settings.production_number_e164) ||
        asSettingString(settings.test_number_e164) ||
        null,
      telnyxConnectionId:
        (typeof gateway.telnyxConnectionId === "string" &&
          gateway.telnyxConnectionId) ||
        null,
      webhookTelnyx: `${publicGateway}/api/webhooks/telnyx`,
      webhookOpenAI: `${publicGateway}/openai/webhook`,
      /** Secrets live in Railway / gateway env — never returned here. */
      secretsNote:
        "API-Keys nur in Railway / voice-gateway .env — hier nur Status.",
    };

    return NextResponse.json({ settings, gateway, connections });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

function asSettingString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v || null;
  if (typeof v === "number") return String(v);
  return null;
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
