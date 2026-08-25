import { NextRequest, NextResponse } from "next/server";
import {
  getContact,
  getContactChannels,
  listTimelineForContact,
  listTasks,
  listLeads,
} from "@/lib/crm";
import { frontendOpenUrl, listProjectsForContact } from "@/lib/projects";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const contact = await getContact(id);
    if (!contact) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    const [channels, timeline, tasks, leads, projectRows] = await Promise.all([
      getContactChannels(id),
      listTimelineForContact(id),
      listTasks({ contactId: id, openOnly: true }),
      listLeads(50, { contactId: id }),
      listProjectsForContact(id).catch((err) => {
        console.error("[crm/contacts] projects", err);
        return [];
      }),
    ]);
    const projects = projectRows.map((p) => ({
      ...p,
      openUrl: frontendOpenUrl(p.id),
      pdfUrl: `/api/projects/${p.id}/pdf`,
    }));
    return NextResponse.json({
      contact,
      channels,
      timeline,
      tasks,
      leads,
      projects,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
