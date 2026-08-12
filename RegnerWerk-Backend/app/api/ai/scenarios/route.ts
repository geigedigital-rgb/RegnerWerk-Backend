import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  listScenarioReleases,
  listScenarios,
  updateScenario,
} from "@/lib/ai/scenarios";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const [scenarios, releases] = await Promise.all([
      listScenarios(),
      listScenarioReleases(10),
    ]);
    return NextResponse.json({ scenarios, releases });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      id?: string;
      name?: string;
      description?: string;
      intent_hints?: string[];
      steps?: string[];
      required_fields?: string[];
      forbidden_actions?: string[];
      stop_on_rules?: string[];
      status?: string;
      priority?: number;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
    }
    const scenario = await updateScenario(body.id, {
      name: body.name,
      description: body.description,
      intent_hints: body.intent_hints,
      steps: body.steps,
      required_fields: body.required_fields,
      forbidden_actions: body.forbidden_actions,
      stop_on_rules: body.stop_on_rules,
      status: body.status,
      priority: body.priority,
    });
    return NextResponse.json({ scenario });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
