import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  listRuleDefinitions,
  listRuleReleases,
  updateRuleDefinition,
} from "@/lib/ai/rules";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiUser("ai.rules.publish");
  if (gate.error) {
    const edit = await requireApiUser("ai.prompt.edit");
    if (edit.error) return edit.error;
  }
  try {
    const [rules, releases] = await Promise.all([
      listRuleDefinitions(),
      listRuleReleases(10),
    ]);
    return NextResponse.json({ rules, releases });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireApiUser("ai.rules.publish");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      id?: string;
      name?: string;
      pattern?: string;
      priority?: number;
      action_type?: string;
      enabled?: boolean;
      fallback?: string;
      test_phrases?: string[];
      change_note?: string;
      match_type?: string;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
    }
    const rule = await updateRuleDefinition(body.id, {
      name: body.name,
      pattern: body.pattern,
      priority: body.priority,
      action_type: body.action_type,
      enabled: body.enabled,
      fallback: body.fallback,
      test_phrases: body.test_phrases,
      change_note: body.change_note,
      match_type: body.match_type,
    });
    return NextResponse.json({ rule });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
