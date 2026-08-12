import { NextRequest, NextResponse } from "next/server";
import { getTelephonySettings } from "@/lib/ai/calls";
import { assertVoiceGatewayAuth } from "@/lib/ai/gateway-auth";

export const dynamic = "force-dynamic";

/** Runtime config for Voice Gateway (pilot, transfers, fallback). */
export async function GET(req: NextRequest) {
  const denied = assertVoiceGatewayAuth(req);
  if (denied) return denied;

  try {
    const settings = await getTelephonySettings();
    const text = (v: unknown) =>
      v == null ? null : typeof v === "string" ? v : String(v);

    return NextResponse.json({
      pilotMode: text(settings.pilot_mode) ?? "after_hours",
      testNumberE164: text(settings.test_number_e164),
      productionNumberE164: text(settings.production_number_e164),
      transferOfficeE164: text(settings.transfer_office_e164),
      transferEmergencyE164: text(settings.transfer_emergency_e164),
      businessHours: settings.business_hours ?? null,
      fallbackPolicy: settings.fallback_policy ?? {
        on_ai_failure: "create_callback_task",
        on_transfer_failure: "create_callback_task",
      },
      recordingEnabled: Boolean(settings.recording_enabled),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
