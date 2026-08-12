import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { evaluateRulesAgainstText, listRuleDefinitions, testRulePhrases } from "@/lib/ai/rules";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as { ruleId?: string; text?: string };
    if (body.ruleId) {
      const result = await testRulePhrases(body.ruleId);
      return NextResponse.json(result);
    }
    if (!body.text?.trim()) {
      return NextResponse.json({ error: "text oder ruleId erforderlich" }, { status: 400 });
    }
    const rules = await listRuleDefinitions();
    const match = evaluateRulesAgainstText(body.text, rules);
    return NextResponse.json({ match });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
