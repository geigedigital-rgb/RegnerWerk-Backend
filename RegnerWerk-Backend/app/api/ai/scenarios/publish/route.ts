import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { publishScenarioRelease } from "@/lib/ai/scenarios";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.publish");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      label?: string;
      changeComment?: string;
    };
    const release = await publishScenarioRelease({
      label: body.label,
      changeComment: body.changeComment,
      userId: gate.user!.id,
    });
    return NextResponse.json({ release }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
