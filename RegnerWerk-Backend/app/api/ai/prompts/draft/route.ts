import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { savePromptDraft } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      documentId?: string;
      content?: string;
      changeNote?: string;
    };
    if (!body.documentId || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "documentId und content erforderlich" },
        { status: 400 },
      );
    }
    const version = await savePromptDraft({
      documentId: body.documentId,
      content: body.content,
      changeNote: body.changeNote,
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
