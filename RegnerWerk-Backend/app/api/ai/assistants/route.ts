import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  listAssistants,
  listToolPolicies,
  saveAssistantDraft,
} from "@/lib/ai/assistants";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const [assistants, toolPolicies] = await Promise.all([
      listAssistants(),
      listToolPolicies(),
    ]);
    return NextResponse.json({ assistants, toolPolicies });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      assistantId?: string;
      configuration?: Record<string, unknown>;
      changeNote?: string;
    };
    if (!body.assistantId || !body.configuration) {
      return NextResponse.json(
        { error: "assistantId und configuration erforderlich" },
        { status: 400 },
      );
    }
    const version = await saveAssistantDraft({
      assistantId: body.assistantId,
      configuration: body.configuration,
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
