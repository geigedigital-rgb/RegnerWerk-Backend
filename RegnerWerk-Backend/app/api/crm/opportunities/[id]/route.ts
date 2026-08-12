import { NextRequest, NextResponse } from "next/server";
import {
  getOpportunity,
  listPipelineStages,
  moveOpportunityStage,
} from "@/lib/crm/pipeline";
import { getContact } from "@/lib/crm";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const detail = await getOpportunity(id);
    if (!detail) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    const [contact, stages] = await Promise.all([
      detail.opportunity.contact_id
        ? getContact(detail.opportunity.contact_id)
        : Promise.resolve(null),
      listPipelineStages(),
    ]);
    return NextResponse.json({ ...detail, contact, stages });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.pipeline.move");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      action?: "move_stage";
      toStageCode?: string;
      reason?: string;
      lossReason?: string;
      lossNote?: string;
    };
    if (body.action !== "move_stage" || !body.toStageCode) {
      return NextResponse.json({ error: "Ungültige action" }, { status: 400 });
    }
    const terminal = ["won", "lost"].includes(body.toStageCode);
    if (terminal) {
      const wonLost = await requireApiUser("crm.pipeline.won_lost");
      if (wonLost.error) return wonLost.error;
    }
    const result = await moveOpportunityStage({
      opportunityId: id,
      toStageCode: body.toStageCode,
      reason: body.reason,
      lossReason: body.lossReason,
      lossNote: body.lossNote,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
