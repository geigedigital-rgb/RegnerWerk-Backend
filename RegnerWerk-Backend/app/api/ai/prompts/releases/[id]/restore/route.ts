import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { restoreReleaseToDrafts } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Load release snapshot into draft editors (does not switch live production). */
export async function POST(_req: Request, ctx: Ctx) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const result = await restoreReleaseToDrafts(id, gate.user?.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
