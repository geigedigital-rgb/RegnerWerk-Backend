import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { publishPromptRelease } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.publish");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      label?: string;
      changeComment?: string;
      environment?: "development" | "staging" | "production";
    };
    const release = await publishPromptRelease({
      label: body.label,
      changeComment: body.changeComment,
      environment: body.environment,
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
