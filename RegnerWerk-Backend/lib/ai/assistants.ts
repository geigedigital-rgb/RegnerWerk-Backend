import { getSupabaseAdmin } from "@/lib/supabase";
import { runTestSuite } from "@/lib/ai/test-lab";
import { getActivePromptRelease } from "@/lib/ai/prompts";
import { getActiveRuleRelease } from "@/lib/ai/rules";
import { listScenarioReleases } from "@/lib/ai/scenarios";

export type ToolPolicy = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type ToolPolicyVersion = {
  id: string;
  tool_policy_id: string;
  version: number;
  status: string;
  tools: Array<{
    tool_name: string;
    autonomy: "auto" | "confirm" | "deny";
    args_schema_note?: string;
  }>;
  change_note: string | null;
  published_at: string | null;
};

export type AiAssistant = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  role: string;
  active: boolean;
  is_default: boolean;
};

export type AssistantConfiguration = {
  environment?: string;
  model?: string;
  voice?: string;
  welcome_message?: string;
  use_active_prompt_release?: boolean;
  use_active_rule_release?: boolean;
  use_active_scenario_release?: boolean;
  prompt_release_id?: string | null;
  rule_release_id?: string | null;
  scenario_release_id?: string | null;
  tool_policy_code?: string;
  tool_policy_version_id?: string | null;
  handoff_codes?: string[];
};

export type AiAssistantVersion = {
  id: string;
  assistant_id: string;
  version: number;
  status: string;
  configuration: AssistantConfiguration;
  change_note: string | null;
  published_at: string | null;
  updated_at: string;
};

export type AssistantBundle = AiAssistant & {
  draft: AiAssistantVersion | null;
  published: AiAssistantVersion | null;
};

export async function listToolPolicies(): Promise<
  Array<ToolPolicy & { published: ToolPolicyVersion | null }>
> {
  const sb = getSupabaseAdmin();
  const { data: policies, error } = await sb
    .from("tool_policies")
    .select("*")
    .eq("active", true)
    .order("code");
  if (error) throw new Error(error.message);

  const { data: versions, error: vErr } = await sb
    .from("tool_policy_versions")
    .select("*")
    .eq("status", "published")
    .order("version", { ascending: false });
  if (vErr) throw new Error(vErr.message);

  return (policies ?? []).map((p) => {
    const published =
      (versions ?? []).find((v) => v.tool_policy_id === p.id) ?? null;
    return {
      ...(p as ToolPolicy),
      published: published
        ? ({
            ...published,
            tools: (published.tools as ToolPolicyVersion["tools"]) ?? [],
          } as ToolPolicyVersion)
        : null,
    };
  });
}

export async function getToolPolicyByCode(
  code: string,
): Promise<(ToolPolicy & { published: ToolPolicyVersion | null }) | null> {
  const all = await listToolPolicies();
  return all.find((p) => p.code === code) ?? null;
}

export async function listAssistants(): Promise<AssistantBundle[]> {
  const sb = getSupabaseAdmin();
  const { data: assistants, error } = await sb
    .from("ai_assistants")
    .select("*")
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("code");
  if (error) throw new Error(error.message);

  const ids = (assistants ?? []).map((a) => a.id);
  const { data: versions, error: vErr } = await sb
    .from("ai_assistant_versions")
    .select("*")
    .in("assistant_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .in("status", ["draft", "published"])
    .order("version", { ascending: false });
  if (vErr) throw new Error(vErr.message);

  return (assistants ?? []).map((a) => {
    const list = (versions ?? []).filter((v) => v.assistant_id === a.id);
    const draft = list.find((v) => v.status === "draft") ?? null;
    const published = list.find((v) => v.status === "published") ?? null;
    return {
      ...(a as AiAssistant),
      draft: draft
        ? ({
            ...draft,
            configuration: (draft.configuration ?? {}) as AssistantConfiguration,
          } as AiAssistantVersion)
        : null,
      published: published
        ? ({
            ...published,
            configuration: (published.configuration ??
              {}) as AssistantConfiguration,
          } as AiAssistantVersion)
        : null,
    };
  });
}

export async function saveAssistantDraft(opts: {
  assistantId: string;
  configuration: AssistantConfiguration;
  changeNote?: string;
  userId?: string;
}): Promise<AiAssistantVersion> {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("ai_assistant_versions")
    .select("*")
    .eq("assistant_id", opts.assistantId)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await sb
      .from("ai_assistant_versions")
      .update({
        configuration: opts.configuration,
        change_note: opts.changeNote ?? existing.change_note,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      ...(data as AiAssistantVersion),
      configuration: (data.configuration ?? {}) as AssistantConfiguration,
    };
  }

  const { data: maxRow } = await sb
    .from("ai_assistant_versions")
    .select("version")
    .eq("assistant_id", opts.assistantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await sb
    .from("ai_assistant_versions")
    .insert({
      assistant_id: opts.assistantId,
      version: (maxRow?.version ?? 0) + 1,
      status: "draft",
      configuration: opts.configuration,
      change_note: opts.changeNote ?? "Draft update",
      created_by: opts.userId ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    ...(data as AiAssistantVersion),
    configuration: (data.configuration ?? {}) as AssistantConfiguration,
  };
}

export async function publishAssistant(opts: {
  assistantId: string;
  userId?: string;
  skipTests?: boolean;
}): Promise<AiAssistantVersion> {
  const bundles = await listAssistants();
  const bundle = bundles.find((a) => a.id === opts.assistantId);
  if (!bundle) throw new Error("Assistent nicht gefunden");
  const draft = bundle.draft;
  if (!draft) throw new Error("Kein Draft vorhanden");

  if (!opts.skipTests) {
    const suite = await runTestSuite({
      criticalOnly: true,
      userId: opts.userId,
    });
    if (suite.criticalFailed > 0) {
      throw new Error(
        `Publish blockiert: critical Test Lab fails (${suite.criticalFailed})`,
      );
    }
  }

  const config: AssistantConfiguration = { ...draft.configuration };

  // Resolve active releases into snapshot IDs when flags set
  if (config.use_active_prompt_release) {
    const pr = await getActivePromptRelease("production");
    config.prompt_release_id = pr?.id ?? null;
  }
  if (config.use_active_rule_release) {
    const rr = await getActiveRuleRelease("production");
    config.rule_release_id = rr?.id ?? null;
  }
  if (config.use_active_scenario_release) {
    const releases = await listScenarioReleases(5);
    const active = releases.find((r) => r.is_active);
    config.scenario_release_id = active?.id ?? null;
  }

  const policy = await getToolPolicyByCode(
    config.tool_policy_code ?? "empfang_default",
  );
  config.tool_policy_version_id = policy?.published?.id ?? null;

  const sb = getSupabaseAdmin();

  // Retire previous published
  await sb
    .from("ai_assistant_versions")
    .update({ status: "retired" })
    .eq("assistant_id", opts.assistantId)
    .eq("status", "published");

  const { data, error } = await sb
    .from("ai_assistant_versions")
    .update({
      status: "published",
      configuration: config,
      published_at: new Date().toISOString(),
      approved_by: opts.userId ?? null,
    })
    .eq("id", draft.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return {
    ...(data as AiAssistantVersion),
    configuration: (data.configuration ?? {}) as AssistantConfiguration,
  };
}

export async function getPublishedAssistantConfig(code?: string): Promise<{
  assistant: AiAssistant;
  version: AiAssistantVersion;
  toolPolicy: ToolPolicyVersion | null;
} | null> {
  const sb = getSupabaseAdmin();
  let q = sb.from("ai_assistants").select("*").eq("active", true);
  if (code) q = q.eq("code", code);
  else q = q.eq("is_default", true);
  const { data: assistant, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!assistant) return null;

  const { data: version } = await sb
    .from("ai_assistant_versions")
    .select("*")
    .eq("assistant_id", assistant.id)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fallback to latest draft if nothing published
  const ver =
    version ??
    (
      await sb
        .from("ai_assistant_versions")
        .select("*")
        .eq("assistant_id", assistant.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data;

  if (!ver) return null;

  const config = (ver.configuration ?? {}) as AssistantConfiguration;
  const policy = await getToolPolicyByCode(
    config.tool_policy_code ?? "empfang_default",
  );

  return {
    assistant: assistant as AiAssistant,
    version: {
      ...(ver as AiAssistantVersion),
      configuration: config,
    },
    toolPolicy: policy?.published ?? null,
  };
}

export async function listReleaseOverview(): Promise<{
  prompts: unknown[];
  rules: unknown[];
  scenarios: unknown[];
  assistants: unknown[];
}> {
  const sb = getSupabaseAdmin();
  const [prompts, rules, scenarios, assistants] = await Promise.all([
    sb
      .from("prompt_releases")
      .select("id, label, compiled_hash, published_at, is_active, environment")
      .order("published_at", { ascending: false })
      .limit(8),
    sb
      .from("rule_releases")
      .select("id, label, compiled_hash, published_at, is_active, environment")
      .order("published_at", { ascending: false })
      .limit(8),
    sb
      .from("scenario_releases")
      .select("id, label, compiled_hash, published_at, is_active, environment")
      .order("published_at", { ascending: false })
      .limit(8),
    sb
      .from("ai_assistant_versions")
      .select(
        "id, version, status, published_at, change_note, assistant_id, ai_assistants(code, name)",
      )
      .in("status", ["published", "draft"])
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  return {
    prompts: prompts.data ?? [],
    rules: rules.data ?? [],
    scenarios: scenarios.data ?? [],
    assistants: assistants.data ?? [],
  };
}
