import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { listReleaseOverview } from "@/lib/ai/assistants";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) {
    const audit = await requireApiUser("audit.read");
    if (audit.error) return audit.error;
  }
  try {
    const overview = await listReleaseOverview();
    return NextResponse.json(overview);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
