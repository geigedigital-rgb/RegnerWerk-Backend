import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  listRecentTestRuns,
  listTestLabCases,
  runTestCase,
  runTestSuite,
} from "@/lib/ai/test-lab";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const [cases, runs] = await Promise.all([
      listTestLabCases(),
      listRecentTestRuns(15),
    ]);
    return NextResponse.json({ cases, runs });
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
    const body = (await req.json().catch(() => ({}))) as {
      mode?: "suite" | "case";
      caseId?: string;
      criticalOnly?: boolean;
    };

    if (body.mode === "case" && body.caseId) {
      const cases = await listTestLabCases();
      const testCase = cases.find((c) => c.id === body.caseId);
      if (!testCase) {
        return NextResponse.json({ error: "Case nicht gefunden" }, { status: 404 });
      }
      const result = await runTestCase(testCase);
      return NextResponse.json({ result });
    }

    const suite = await runTestSuite({
      criticalOnly: body.criticalOnly !== false,
      userId: gate.user!.id,
    });
    return NextResponse.json({ suite });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
