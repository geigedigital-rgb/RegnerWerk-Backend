"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FlaskConical, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Case = {
  id: string;
  code: string;
  name: string;
  persona: string | null;
  customer_phrases: string[];
  expected_intent: string | null;
  expected_stop_rule: string | null;
  critical: boolean;
  tags: string[];
};

type CaseResult = {
  caseId: string;
  code: string;
  name: string;
  critical: boolean;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  matchedScenario: string | null;
  matchedStopRule: string | null;
};

type Suite = {
  passed: boolean;
  total: number;
  failed: number;
  criticalFailed: number;
  results: CaseResult[];
};

export function TestLabStudio() {
  const [cases, setCases] = useState<Case[]>([]);
  const [suite, setSuite] = useState<Suite | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/test-lab", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setCases(data.cases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runSuite(criticalOnly: boolean) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/test-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "suite", criticalOnly }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run fehlgeschlagen");
      setSuite(data.suite);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setRunning(false);
    }
  }

  async function runOne(caseId: string) {
    setRunning(true);
    setError(null);
    setSelected(caseId);
    try {
      const res = await fetch("/api/ai/test-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "case", caseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run fehlgeschlagen");
      setSuite({
        passed: data.result.passed,
        total: 1,
        failed: data.result.passed ? 0 : 1,
        criticalFailed: data.result.passed || !data.result.critical ? 0 : 1,
        results: [data.result],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setRunning(false);
    }
  }

  const detail =
    suite?.results.find((r) => r.caseId === selected) ?? suite?.results[0] ?? null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-12 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Test Lab laden…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-aqua-deep">
            KI-Assistent · §18
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-forest">
            Test Lab
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600">
            Text-Regression: Stop-Regeln, Intent/Szenario und Policy-Grenzen.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => void runSuite(true)}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
          >
            {running ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FlaskConical size={14} />
            )}
            Critical Suite
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void runSuite(false)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-forest disabled:opacity-50"
          >
            Alle Cases
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {suite ? (
        <div
          className={cn(
            "mt-4 rounded-2xl border px-4 py-3 text-sm",
            suite.criticalFailed === 0
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : "border-red-100 bg-red-50 text-red-800",
          )}
        >
          {suite.criticalFailed === 0 ? "Critical suite PASS" : "Critical suite FAIL"}{" "}
          — {suite.total - suite.failed}/{suite.total} ok, critical fails:{" "}
          {suite.criticalFailed}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-3xl border border-gray-100 bg-white p-4">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Cases ({cases.length})
          </p>
          <ul className="mt-2 max-h-[70vh] space-y-1 overflow-auto">
            {cases.map((c) => {
              const result = suite?.results.find((r) => r.caseId === c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void runOne(c.id)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-2xl px-3 py-2 text-left hover:bg-gray-50",
                      selected === c.id && "bg-mint",
                    )}
                  >
                    {result ? (
                      result.passed ? (
                        <CheckCircle2 size={16} className="mt-0.5 text-emerald-600" />
                      ) : (
                        <XCircle size={16} className="mt-0.5 text-red-600" />
                      )
                    ) : (
                      <span className="mt-0.5 h-4 w-4 rounded-full border border-gray-200" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-forest">
                        {c.name}
                        {c.critical ? (
                          <span className="ml-2 text-[10px] uppercase text-amber-700">
                            critical
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[11px] text-gray-400">
                        {c.code}
                        {c.expected_stop_rule
                          ? ` · stop:${c.expected_stop_rule}`
                          : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          {detail ? (
            <>
              <h2 className="text-lg font-semibold text-forest">{detail.name}</h2>
              <p className="mt-1 text-xs text-gray-500">
                Scenario: {detail.matchedScenario ?? "—"} · Stop:{" "}
                {detail.matchedStopRule ?? "—"}
              </p>
              <ul className="mt-4 space-y-2">
                {detail.checks.map((ch) => (
                  <li
                    key={ch.name}
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-sm",
                      ch.passed
                        ? "border-emerald-50 bg-emerald-50/50 text-emerald-900"
                        : "border-red-50 bg-red-50/50 text-red-900",
                    )}
                  >
                    <p className="font-medium">
                      {ch.passed ? "PASS" : "FAIL"} · {ch.name}
                    </p>
                    <p className="text-xs opacity-80">{ch.detail}</p>
                  </li>
                ))}
              </ul>
              {cases.find((c) => c.id === detail.caseId)?.customer_phrases[0] ? (
                <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-forest/95 p-4 text-xs text-mint">
                  {cases.find((c) => c.id === detail.caseId)?.customer_phrases[0]}
                </pre>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Critical Suite starten oder einzelnen Case anklicken.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
