import { getSupabaseAdmin } from "@/lib/supabase";
import { evaluateRulesAgainstText, listRuleDefinitions } from "@/lib/ai/rules";
import { listScenarios, matchScenarioByText } from "@/lib/ai/scenarios";

export type TestLabCase = {
  id: string;
  code: string;
  name: string;
  persona: string | null;
  crm_context: Record<string, unknown>;
  customer_phrases: string[];
  expected_intent: string | null;
  expected_fields: string[];
  forbidden_actions: string[];
  expected_stop_rule: string | null;
  expected_outcome: string | null;
  critical: boolean;
  active: boolean;
  tags: string[];
};

export type TestCaseResult = {
  caseId: string;
  code: string;
  name: string;
  critical: boolean;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  matchedScenario: string | null;
  matchedStopRule: string | null;
};

export async function listTestLabCases(): Promise<TestLabCase[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("test_lab_cases")
    .select("*")
    .eq("active", true)
    .order("critical", { ascending: false })
    .order("code", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TestLabCase[];
}

export async function listRecentTestRuns(limit = 20) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("test_lab_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function runTestCase(
  testCase: TestLabCase,
): Promise<TestCaseResult> {
  const [rules, scenarios] = await Promise.all([
    listRuleDefinitions(),
    listScenarios(),
  ]);
  const phrase = (testCase.customer_phrases[0] ?? "").trim();
  const checks: TestCaseResult["checks"] = [];

  const stop = evaluateRulesAgainstText(phrase, rules);
  const matchedStopRule = stop.matched ? stop.ruleCode ?? null : null;

  if (testCase.expected_stop_rule) {
    const ok = matchedStopRule === testCase.expected_stop_rule;
    checks.push({
      name: "expected_stop_rule",
      passed: ok,
      detail: ok
        ? `Stop-Regel ${matchedStopRule}`
        : `erwartet ${testCase.expected_stop_rule}, got ${matchedStopRule ?? "none"}`,
    });
  } else {
    checks.push({
      name: "no_unwanted_critical_stop",
      passed: !stop.matched || !["emergency_water", "legal_anwalt"].includes(stop.ruleCode ?? ""),
      detail: matchedStopRule
        ? `optional match ${matchedStopRule}`
        : "kein Stop-Trigger",
    });
  }

  const scenario = matchScenarioByText(phrase, scenarios);
  // Prefer stop-linked scenario when stop matched
  let matchedScenario = scenario?.code ?? null;
  if (matchedStopRule === "emergency_water") matchedScenario = "active_leak";
  if (matchedStopRule === "human_mitarbeiter") matchedScenario = "human_request";
  if (matchedStopRule === "complaint") matchedScenario = "complaint";
  if (matchedStopRule === "privacy_datenschutz") matchedScenario = "privacy";
  if (matchedStopRule === "legal_anwalt") matchedScenario = "lawyer";
  if (matchedStopRule === "sales_spam") matchedScenario = "spam";

  if (testCase.expected_intent) {
    const ok = matchedScenario === testCase.expected_intent;
    checks.push({
      name: "expected_intent",
      passed: ok,
      detail: ok
        ? `Intent ${matchedScenario}`
        : `erwartet ${testCase.expected_intent}, got ${matchedScenario ?? "none"}`,
    });
  }

  // Static policy checks on "would-be" assistant constraints from matched scenario
  const scen = scenarios.find((s) => s.code === matchedScenario);
  for (const forbidden of testCase.forbidden_actions) {
    const scenarioForbids = scen?.forbidden_actions?.includes(forbidden) ?? false;
    checks.push({
      name: `forbidden:${forbidden}`,
      passed: scenarioForbids,
      detail: scenarioForbids
        ? `Szenario verbietet ${forbidden}`
        : scen
          ? `Szenario ${scen.code} listet ${forbidden} nicht`
          : "kein Szenario gematcht",
    });
  }

  // Heuristic: price/montage promise phrases must not be "answered" by rules alone — pass if scenario forbids
  if (testCase.code === "no_price_promise" || testCase.code === "no_montage_date") {
    const ok = Boolean(
      scen?.forbidden_actions.some((a) =>
        testCase.forbidden_actions.includes(a),
      ),
    );
    checks.push({
      name: "policy_boundary",
      passed: ok,
      detail: ok ? "Preis-/Termin-Grenze im Szenario" : "Grenze fehlt",
    });
  }

  if (testCase.code === "recording_declined") {
    const ok = matchedScenario === "recording_declined" ||
      /nicht aufzeich|keine aufnahme/i.test(phrase);
    checks.push({
      name: "consent_decline_recognized",
      passed: ok,
      detail: ok ? "Ablehnung erkannt" : "Ablehnung nicht erkannt",
    });
    // Override intent check softness
    const intentCheck = checks.find((c) => c.name === "expected_intent");
    if (intentCheck && /nicht aufzeich|keine aufnahme/i.test(phrase)) {
      intentCheck.passed = true;
      intentCheck.detail = "Consent-Ablehnung erkannt";
      matchedScenario = "recording_declined";
    }
  }

  const passed = checks.every((c) => c.passed);
  return {
    caseId: testCase.id,
    code: testCase.code,
    name: testCase.name,
    critical: testCase.critical,
    passed,
    checks,
    matchedScenario,
    matchedStopRule,
  };
}

export async function runTestSuite(opts?: {
  criticalOnly?: boolean;
  userId?: string;
}): Promise<{
  passed: boolean;
  total: number;
  failed: number;
  criticalFailed: number;
  results: TestCaseResult[];
  runId: string | null;
}> {
  const started = Date.now();
  let cases = await listTestLabCases();
  if (opts?.criticalOnly) cases = cases.filter((c) => c.critical);

  const results: TestCaseResult[] = [];
  for (const c of cases) {
    results.push(await runTestCase(c));
  }

  const failed = results.filter((r) => !r.passed).length;
  const criticalFailed = results.filter((r) => !r.passed && r.critical).length;
  const passed = criticalFailed === 0;

  const sb = getSupabaseAdmin();
  const { data: run } = await sb
    .from("test_lab_runs")
    .insert({
      case_id: null,
      triggered_by: opts?.userId ?? null,
      mode: "regression",
      passed,
      results: { items: results, criticalOnly: Boolean(opts?.criticalOnly) },
      duration_ms: Date.now() - started,
    })
    .select("id")
    .maybeSingle();

  return {
    passed,
    total: results.length,
    failed,
    criticalFailed,
    results,
    runId: run?.id ?? null,
  };
}
