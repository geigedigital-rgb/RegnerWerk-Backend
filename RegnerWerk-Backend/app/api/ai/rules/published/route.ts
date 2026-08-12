import { NextResponse } from "next/server";
import { getActiveRuleRelease, listRuleDefinitions } from "@/lib/ai/rules";

export const dynamic = "force-dynamic";

/** Internal: Voice Gateway loads active rule release (fallback: live enabled rules). */
export async function GET(req: Request) {
  const secret = process.env.VOICE_GATEWAY_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const headerKey = req.headers.get("x-voice-gateway-key") ?? "";
    if (token !== secret && headerKey !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const release = await getActiveRuleRelease("production");
    if (release) {
      return NextResponse.json({
        release: {
          id: release.id,
          hash: release.compiled_hash,
          rules: release.compiled_snapshot,
          publishedAt: release.published_at,
        },
      });
    }
    const rules = (await listRuleDefinitions()).filter((r) => r.enabled);
    return NextResponse.json({
      release: {
        id: "live-draft",
        hash: "live",
        rules,
        publishedAt: null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
