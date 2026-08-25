import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { addPromptReleaseReview } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) {
    const pub = await requireApiUser("ai.prompt.publish");
    if (pub.error) return pub.error;
    try {
      const { id } = await ctx.params;
      const body = (await req.json()) as {
        rating?: number | null;
        comment?: string;
      };
      const review = await addPromptReleaseReview({
        releaseId: id,
        rating: body.rating,
        comment: body.comment,
        userId: pub.user?.id,
      });
      return NextResponse.json({ review });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Fehler" },
        { status: 500 },
      );
    }
  }
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      rating?: number | null;
      comment?: string;
    };
    const review = await addPromptReleaseReview({
      releaseId: id,
      rating: body.rating,
      comment: body.comment,
      userId: gate.user?.id,
    });
    return NextResponse.json({ review });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
