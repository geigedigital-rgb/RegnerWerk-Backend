import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

export type ScenarioDefinition = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  intent_hints: string[];
  steps: string[];
  required_fields: string[];
  forbidden_actions: string[];
  stop_on_rules: string[];
  status: string;
  priority: number;
  active: boolean;
  updated_at: string;
};

export type ScenarioRelease = {
  id: string;
  environment: string;
  label: string | null;
  compiled_snapshot: ScenarioDefinition[];
  compiled_hash: string;
  published_at: string;
  is_active: boolean;
  change_comment: string | null;
};

function normalize(row: Record<string, unknown>): ScenarioDefinition {
  return {
    ...(row as unknown as ScenarioDefinition),
    steps: Array.isArray(row.steps) ? (row.steps as string[]) : [],
    intent_hints: (row.intent_hints as string[]) ?? [],
    required_fields: (row.required_fields as string[]) ?? [],
    forbidden_actions: (row.forbidden_actions as string[]) ?? [],
    stop_on_rules: (row.stop_on_rules as string[]) ?? [],
  };
}

export async function listScenarios(): Promise<ScenarioDefinition[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("scenario_definitions")
    .select("*")
    .eq("active", true)
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function updateScenario(
  id: string,
  patch: Partial<
    Pick<
      ScenarioDefinition,
      | "name"
      | "description"
      | "intent_hints"
      | "steps"
      | "required_fields"
      | "forbidden_actions"
      | "stop_on_rules"
      | "status"
      | "priority"
    >
  >,
): Promise<ScenarioDefinition> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("scenario_definitions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return normalize(data as Record<string, unknown>);
}

export async function listScenarioReleases(limit = 10): Promise<ScenarioRelease[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("scenario_releases")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...(r as ScenarioRelease),
    compiled_snapshot: (r.compiled_snapshot as ScenarioDefinition[]) ?? [],
  }));
}

export async function publishScenarioRelease(opts: {
  label?: string;
  changeComment?: string;
  userId?: string;
}): Promise<ScenarioRelease> {
  const scenarios = (await listScenarios()).filter(
    (s) => s.status === "published" || s.status === "approved",
  );
  const snapshot = scenarios.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    priority: s.priority,
    intent_hints: s.intent_hints,
    steps: s.steps,
    required_fields: s.required_fields,
    forbidden_actions: s.forbidden_actions,
    stop_on_rules: s.stop_on_rules,
  }));
  const compiled_hash = createHash("sha256")
    .update(JSON.stringify(snapshot), "utf8")
    .digest("hex");
  const sb = getSupabaseAdmin();
  await sb
    .from("scenario_releases")
    .update({ is_active: false })
    .eq("environment", "production")
    .eq("is_active", true);

  const { data, error } = await sb
    .from("scenario_releases")
    .insert({
      environment: "production",
      label: opts.label ?? `Scenarios ${new Date().toISOString().slice(0, 16)}`,
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
    ...(data as ScenarioRelease),
    compiled_snapshot: snapshot as unknown as ScenarioDefinition[],
  };
}

export function matchScenarioByText(
  text: string,
  scenarios: ScenarioDefinition[],
): ScenarioDefinition | null {
  const lower = text.toLowerCase();
  const ranked = [...scenarios].sort((a, b) => a.priority - b.priority);

  // Extra lexical boosts beyond stored hints
  const boosts: Array<{ re: RegExp; code: string }> = [
    { re: /rohrbruch|wasserschaden|notfall|leck/, code: "active_leak" },
    { re: /mitarbeiter|chef|mensch sprechen/, code: "human_request" },
    { re: /beschwerde|reklamation/, code: "complaint" },
    { re: /datenschutz|dsgvo/, code: "privacy" },
    { re: /anwalt|klage/, code: "lawyer" },
    { re: /seo|google ads/, code: "spam" },
    { re: /nicht aufzeich|keine aufnahme/, code: "recording_declined" },
    { re: /einwinter/, code: "winterization" },
    { re: /erweiter/, code: "extension" },
    { re: /reparatur|defekt|funktioniert nicht/, code: "repair" },
    { re: /kostet|preis|quadratmeter|neue bewässer|neuen garten|neuanlage/, code: "new_system" },
    { re: /montage.?termin|nächste woche garant/, code: "new_system" },
  ];
  for (const b of boosts) {
    if (b.re.test(lower)) {
      const hit = ranked.find((s) => s.code === b.code);
      if (hit) return hit;
    }
  }

  for (const s of ranked) {
    if (s.intent_hints.some((h) => lower.includes(h.toLowerCase()))) {
      return s;
    }
  }
  return ranked.find((s) => s.code === "unknown_intent") ?? null;
}
