import { NextRequest, NextResponse } from "next/server";
import { getMontageProject, updateMontageProject } from "@/lib/crm/pipeline";
import { getContact } from "@/lib/crm";
import type { MontageProject } from "@/lib/crm/types";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const project = await getMontageProject(id);
    if (!project) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    const contact = project.contact_id
      ? await getContact(project.contact_id)
      : null;
    return NextResponse.json({ project, contact });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.montage.write");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Partial<
      Pick<
        MontageProject,
        "status" | "next_action" | "next_action_due_at" | "scope_summary" | "name"
      >
    >;
    const project = await updateMontageProject(id, body);
    return NextResponse.json({ project });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
