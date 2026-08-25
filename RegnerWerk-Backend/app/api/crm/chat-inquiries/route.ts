import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/crm/chat-inquiries
 * Lists website support_chat form submissions for CRM.
 */
export async function GET(req: NextRequest) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;

  try {
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50,
      100,
    );
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("web_form_submissions")
      .select(
        "id, submission_id, form_type, received_at, reference_code, payload_sanitized, landing_page, processing_status, inbox_item_id, lead_id",
      )
      .eq("form_type", "support_chat")
      .order("received_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    const items = (data ?? []).map((row) => {
      const payload = (row.payload_sanitized ?? {}) as Record<string, unknown>;
      return {
        id: row.id as string,
        submission_id: row.submission_id as string,
        received_at: row.received_at as string,
        reference_code: row.reference_code as string,
        landing_page: (row.landing_page as string | null) ?? null,
        processing_status: row.processing_status as string,
        inbox_item_id: (row.inbox_item_id as string | null) ?? null,
        lead_id: (row.lead_id as string | null) ?? null,
        name: typeof payload.name === "string" ? payload.name : null,
        phone: typeof payload.phone === "string" ? payload.phone : null,
        email: typeof payload.email === "string" ? payload.email : null,
        postal_code:
          typeof payload.postal_code === "string" ? payload.postal_code : null,
        message: typeof payload.message === "string" ? payload.message : null,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
