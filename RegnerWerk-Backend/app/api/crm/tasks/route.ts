import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/crm";
import type { Priority, Task } from "@/lib/crm/types";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const contactId = req.nextUrl.searchParams.get("contactId") ?? undefined;
    const leadId = req.nextUrl.searchParams.get("leadId") ?? undefined;
    const tasks = await listTasks({
      contactId,
      leadId,
      openOnly: true,
    });
    return NextResponse.json({ tasks });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireApiUser("crm.lead.write");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      type?: Task["type"];
      priority?: Priority;
      due_at?: string;
      related_contact_id?: string;
      related_lead_id?: string;
    };
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title erforderlich" }, { status: 400 });
    }
    const task = await createTask({
      title: body.title,
      description: body.description,
      type: body.type,
      priority: body.priority,
      due_at: body.due_at,
      related_contact_id: body.related_contact_id,
      related_lead_id: body.related_lead_id,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
