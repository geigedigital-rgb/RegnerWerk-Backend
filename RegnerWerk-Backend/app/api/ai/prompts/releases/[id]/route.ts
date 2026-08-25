import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getPromptRelease } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) {
    const pub = await requireApiUser("ai.prompt.publish");
    if (pub.error) return pub.error;
  }
  try {
    const { id } = await ctx.params;
    const data = await getPromptRelease(id);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
