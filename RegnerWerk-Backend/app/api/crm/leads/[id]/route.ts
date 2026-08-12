import { NextRequest, NextResponse } from "next/server";
import {
  getContact,
  getLead,
  listTimelineForLead,
  listTasks,
  updateLead,
} from "@/lib/crm";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const lead = await getLead(id);
    if (!lead) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    const [contact, timeline, tasks] = await Promise.all([
      lead.contact_id ? getContact(lead.contact_id) : Promise.resolve(null),
      listTimelineForLead(id),
      listTasks({ leadId: id, openOnly: true }),
    ]);
    return NextResponse.json({ lead, contact, timeline, tasks });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.lead.write");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const lead = await updateLead(id, body);
    return NextResponse.json({ lead });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
