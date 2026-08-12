import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

export type RuleDefinition = {
  id: string;
  code: string;
  name: string;
  category: string;
  match_type: string;
  pattern: string;
  language: string;
  priority: number;
  action_type: string;
  action_payload: Record<string, unknown>;
  fallback: string | null;
  critical: boolean;
  enabled: boolean;
  test_phrases: string[];
  change_note: string | null;
  updated_at: string;
};

export type RuleRelease = {
  id: string;
  environment: string;
  label: string | null;
  compiled_snapshot: RuleDefinition[];
  compiled_hash: string;
  change_comment: string | null;
  published_at: string;
  is_active: boolean;
};

export type StopRuleMatch = {
  matched: boolean;
  ruleCode?: string;
  actionType?: string;
  reason?: string;
  priority?: number;
};

function hashSnapshot(rules: unknown) {
  return createHash("sha256").update(JSON.stringify(rules), "utf8").digest("hex");
}

export async function listRuleDefinitions(): Promise<RuleDefinition[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("rule_definitions")
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RuleDefinition[];
}

export async function updateRuleDefinition(
  id: string,
  patch: Partial<
    Pick<
      RuleDefinition,
      | "name"
      | "pattern"
      | "priority"
      | "action_type"
      | "action_payload"
      | "enabled"
      | "fallback"
      | "test_phrases"
      | "change_note"
      | "match_type"
    >
  >,
): Promise<RuleDefinition> {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("rule_definitions")
    .select("critical, enabled")
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw new Error("Regel nicht gefunden");
  if (existing.critical && patch.enabled === false) {
    throw new Error("Kritische Regel kann nicht deaktiviert werden (Owner-Flow folgt)");
  }

  const { data, error } = await sb
    .from("rule_definitions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as RuleDefinition;
}

export async function listRuleReleases(limit = 20): Promise<RuleRelease[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("rule_releases")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...(r as RuleRelease),
    compiled_snapshot: (r.compiled_snapshot as RuleDefinition[]) ?? [],
  }));
}

export async function publishRuleRelease(opts: {
  label?: string;
  changeComment?: string;
  userId?: string;
  environment?: string;
}): Promise<RuleRelease> {
  const env = opts.environment ?? "production";
  const rules = (await listRuleDefinitions()).filter((r) => r.enabled);
  const snapshot = rules.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    match_type: r.match_type,
    pattern: r.pattern,
    priority: r.priority,
    action_type: r.action_type,
    action_payload: r.action_payload,
    critical: r.critical,
    language: r.language,
  }));
  const compiled_hash = hashSnapshot(snapshot);
  const sb = getSupabaseAdmin();

  await sb
    .from("rule_releases")
    .update({ is_active: false })
    .eq("environment", env)
    .eq("is_active", true);

  const { data, error } = await sb
    .from("rule_releases")
    .insert({
      environment: env,
      label: opts.label ?? `Rules ${new Date().toISOString().slice(0, 16)}`,
      compiled_snapshot: snapshot,
      compiled_hash,
      change_comment: opts.changeComment ?? null,
      published_by: opts.userId ?? null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    ...(data as RuleRelease),
    compiled_snapshot: snapshot as unknown as RuleDefinition[],
  };
}

export async function getActiveRuleRelease(
  environment = "production",
): Promise<RuleRelease | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("rule_releases")
    .select("*")
    .eq("environment", environment)
    .eq("is_active", true)
    .is("retired_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...(data as RuleRelease),
    compiled_snapshot: (data.compiled_snapshot as RuleDefinition[]) ?? [],
  };
}

/** Evaluate transcript against a compiled snapshot (or live definitions). */
export function evaluateRulesAgainstText(
  text: string,
  rules: Array<{
    code: string;
    match_type: string;
    pattern: string;
    priority: number;
    action_type: string;
    action_payload?: Record<string, unknown>;
    enabled?: boolean;
  }>,
): StopRuleMatch {
  const sorted = [...rules]
    .filter((r) => r.enabled !== false)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    let hit = false;
    try {
      if (rule.match_type === "exact") {
        hit = text.trim().toLowerCase() === rule.pattern.trim().toLowerCase();
      } else if (rule.match_type === "regex" || rule.match_type === "keyword") {
        const re = new RegExp(rule.pattern, "i");
        hit = re.test(text);
      } else {
        // semantic deferred — keyword fallback
        const re = new RegExp(rule.pattern, "i");
        hit = re.test(text);
      }
    } catch {
      continue;
    }
    if (hit) {
      const reason =
        (rule.action_payload?.reason as string | undefined) ?? rule.code;
      return {
        matched: true,
        ruleCode: rule.code,
        actionType: rule.action_type,
        reason,
        priority: rule.priority,
      };
    }
  }
  return { matched: false };
}

export async function testRulePhrases(ruleId: string): Promise<{
  rule: RuleDefinition;
  results: Array<{ phrase: string; matched: boolean }>;
}> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("rule_definitions")
    .select("*")
    .eq("id", ruleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Regel nicht gefunden");
  const rule = data as RuleDefinition;
  const results = (rule.test_phrases ?? []).map((phrase) => ({
    phrase,
    matched: evaluateRulesAgainstText(phrase, [rule]).matched,
  }));
  return { rule, results };
}
