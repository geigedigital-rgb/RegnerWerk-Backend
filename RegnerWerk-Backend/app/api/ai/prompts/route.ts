import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { listPromptReleases, listPromptStudio } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) {
    const publishGate = await requireApiUser("ai.prompt.publish");
    if (publishGate.error) return publishGate.error;
  }
  try {
    const [studio, releases] = await Promise.all([
      listPromptStudio(),
      listPromptReleases(30),
    ]);
    return NextResponse.json({ ...studio, releases });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
