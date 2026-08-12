import { NextResponse } from "next/server";
import { listOpportunities, listPipelineStages } from "@/lib/crm/pipeline";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const [stages, opportunities] = await Promise.all([
      listPipelineStages(),
      listOpportunities(),
    ]);
    return NextResponse.json({ stages, opportunities });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
