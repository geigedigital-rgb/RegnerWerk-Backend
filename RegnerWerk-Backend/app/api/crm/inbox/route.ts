import { NextRequest, NextResponse } from "next/server";
import { createInboxItem, listInboxItems } from "@/lib/crm";
import type { InboxSourceType, Priority, RequestType } from "@/lib/crm/types";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const status = req.nextUrl.searchParams.get("status") ?? "open";
    const items = await listInboxItems({ status });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireApiUser("crm.inbox.triage");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      summary?: string;
      source_type?: InboxSourceType;
      request_type?: RequestType;
      contact_name?: string;
      contact_phone?: string;
      contact_email?: string;
      postal_code?: string;
      priority?: Priority;
    };
    if (!body.summary?.trim()) {
      return NextResponse.json({ error: "summary erforderlich" }, { status: 400 });
    }
    const item = await createInboxItem({
      summary: body.summary,
      source_type: body.source_type,
      request_type: body.request_type,
      contact_name: body.contact_name,
      contact_phone: body.contact_phone,
      contact_email: body.contact_email,
      postal_code: body.postal_code,
      priority: body.priority,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
