import { NextResponse } from "next/server";
import { getPublishedAssistantConfig } from "@/lib/ai/assistants";
import { getActivePromptRelease } from "@/lib/ai/prompts";
import { getActiveRuleRelease } from "@/lib/ai/rules";

export const dynamic = "force-dynamic";

/** Internal: Voice Gateway loads default Empfang assistant bundle. */
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
    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? undefined;
    const bundle = await getPublishedAssistantConfig(code);
    if (!bundle) {
      return NextResponse.json({ assistant: null });
    }

    const [prompt, rules] = await Promise.all([
      getActivePromptRelease("production"),
      getActiveRuleRelease("production"),
    ]);

    const allowedTools = (bundle.toolPolicy?.tools ?? [])
      .filter((t) => t.autonomy !== "deny")
      .map((t) => t.tool_name);

    return NextResponse.json({
      assistant: {
        code: bundle.assistant.code,
        name: bundle.assistant.name,
        role: bundle.assistant.role,
        version: bundle.version.version,
        status: bundle.version.status,
        configuration: bundle.version.configuration,
        allowedTools,
        toolPolicy: bundle.toolPolicy,
        promptReleaseId:
          bundle.version.configuration.prompt_release_id ?? prompt?.id ?? null,
        ruleReleaseId:
          bundle.version.configuration.rule_release_id ?? rules?.id ?? null,
        welcomeMessage:
          bundle.version.configuration.welcome_message ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
