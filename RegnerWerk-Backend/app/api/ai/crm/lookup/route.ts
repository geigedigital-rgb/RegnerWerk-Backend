import { NextRequest, NextResponse } from "next/server";
import { findContactsByPhone } from "@/lib/crm";
import { assertVoiceGatewayAuth } from "@/lib/ai/gateway-auth";

export const dynamic = "force-dynamic";

/**
 * Internal CRM phone lookup for Voice Gateway (TZ LINK-001).
 * Returns minimal identity — no private notes.
 */
export async function GET(req: NextRequest) {
  const denied = assertVoiceGatewayAuth(req);
  if (denied) return denied;

  try {
    const phone = req.nextUrl.searchParams.get("phone")?.trim() ?? "";
    if (!phone) {
      return NextResponse.json({ status: "none" });
    }
    const contacts = await findContactsByPhone(phone);
    if (contacts.length === 0) {
      return NextResponse.json({ status: "none" });
    }
    if (contacts.length === 1) {
      const c = contacts[0];
      return NextResponse.json({
        status: "single",
        contactId: c.id,
        displayName: c.display_name,
        customerStatus: c.customer_status,
        kind: c.kind,
      });
    }
    return NextResponse.json({
      status: "ambiguous",
      contactIds: contacts.map((c) => c.id),
      candidates: contacts.slice(0, 5).map((c) => ({
        contactId: c.id,
        displayName: c.display_name,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
