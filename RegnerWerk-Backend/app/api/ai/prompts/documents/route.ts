import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { createPromptDocument } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      code?: string;
      name?: string;
      description?: string;
      content?: string;
    };
    if (!body.code?.trim() || !body.name?.trim()) {
      return NextResponse.json(
        { error: "code und name erforderlich" },
        { status: 400 },
      );
    }
    const doc = await createPromptDocument({
      code: body.code,
      name: body.name,
      description: body.description,
      content: body.content,
      userId: gate.user?.id,
    });
    return NextResponse.json({ document: doc });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
