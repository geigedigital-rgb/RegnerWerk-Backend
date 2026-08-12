import { NextRequest, NextResponse } from "next/server";
import { getServiceCase, updateServiceCase } from "@/lib/crm/service";
import { getContact, listTimelineForContact } from "@/lib/crm";
import type { ServiceCase } from "@/lib/crm/types";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const serviceCase = await getServiceCase(id);
    if (!serviceCase) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    const contact = serviceCase.contact_id
      ? await getContact(serviceCase.contact_id)
      : null;
    const timeline = serviceCase.contact_id
      ? await listTimelineForContact(serviceCase.contact_id, 30)
      : [];
    return NextResponse.json({ serviceCase, contact, timeline });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.service.write");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Partial<
      Pick<
        ServiceCase,
        | "status"
        | "urgency"
        | "type"
        | "next_action"
        | "next_action_due_at"
        | "resolution_summary"
        | "problem_description"
        | "title"
        | "scheduled_at"
      >
    >;
    const serviceCase = await updateServiceCase(id, body);
    return NextResponse.json({ serviceCase });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
