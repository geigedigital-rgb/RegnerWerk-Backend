import { NextRequest, NextResponse } from "next/server";
import { convertLeadToOpportunity } from "@/lib/crm/pipeline";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/crm/leads/[id]/convert → Pipeline opportunity */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.pipeline.move");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const result = await convertLeadToOpportunity(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
