import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { publishAssistant } from "@/lib/ai/assistants";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("ai.prompt.publish");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const version = await publishAssistant({
      assistantId: id,
      userId: gate.user!.id,
    });
    return NextResponse.json({ version });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
