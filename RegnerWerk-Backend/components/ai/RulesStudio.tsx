"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Loader2, Rocket, Save, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type Rule = {
  id: string;
  code: string;
  name: string;
  category: string;
  match_type: string;
  pattern: string;
  priority: number;
  action_type: string;
  critical: boolean;
  enabled: boolean;
  test_phrases: string[];
};

type Release = {
  id: string;
  label: string | null;
  compiled_hash: string;
  published_at: string;
  is_active: boolean;
};

export function RulesStudio() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pattern, setPattern] = useState("");
  const [priority, setPriority] = useState(100);
  const [enabled, setEnabled] = useState(true);
  const [name, setName] = useState("");
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const active = rules.find((r) => r.id === activeId) ?? rules[0] ?? null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/rules", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setRules(data.rules ?? []);
      setReleases(data.releases ?? []);
      if (!activeId && data.rules?.[0]) setActiveId(data.rules[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!active) return;
    setName(active.name);
    setPattern(active.pattern);
    setPriority(active.priority);
    setEnabled(active.enabled);
  }, [active?.id]);

  async function save() {
    if (!active) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/ai/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: active.id,
          name,
          pattern,
          priority,
          enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      setOk("Regel gespeichert (noch nicht published)");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/ai/rules/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeComment: "Publish from Rules Studio" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish fehlgeschlagen");
      setOk(`Release aktiv: ${data.release?.compiled_hash?.slice(0, 12)}…`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/rules/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          testText.trim()
            ? { text: testText }
            : { ruleId: active?.id },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test fehlgeschlagen");
      if (data.match) {
        setTestResult(
          data.match.matched
            ? `Match: ${data.match.ruleCode} → ${data.match.actionType} (${data.match.reason})`
            : "Kein Match",
        );
      } else if (data.results) {
        const lines = data.results.map(
          (r: { phrase: string; matched: boolean }) =>
            `${r.matched ? "✓" : "✗"} ${r.phrase}`,
        );
        setTestResult(lines.join("\n"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-12 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Regeln laden…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-aqua-deep">
            KI-Assistent · §16
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-forest">
            Regeln & Stop-Trigger
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600">
            Server-seitige Eskalation — kritische Regeln haben Vorrang vor dem Prompt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !active}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-forest disabled:opacity-50"
          >
            <Save size={14} /> Speichern
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
          >
            <Rocket size={14} /> Publish
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_260px]">
        <aside className="rounded-3xl border border-gray-100 bg-white p-3">
          <ul className="max-h-[70vh] space-y-0.5 overflow-auto">
            {rules.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-2xl px-3 py-2 text-left",
                    active?.id === r.id ? "bg-mint" : "hover:bg-gray-50",
                  )}
                >
                  {r.critical ? (
                    <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  ) : (
                    <span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-forest">
                      {r.name}
                    </span>
                    <span className="block text-[11px] text-gray-400">
                      P{r.priority} · {r.category}
                      {!r.enabled ? " · off" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          {active ? (
            <>
              <p className="text-xs text-gray-400">{active.code}</p>
              <label className="mt-2 block">
                <span className="mb-1 block text-sm font-medium text-forest">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-forest">
                    Priorität (niedriger = früher)
                  </span>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                  />
                </label>
                <label className="flex items-end gap-2 pb-3 text-sm text-forest">
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={active.critical}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  Aktiv
                  {active.critical ? (
                    <span className="text-xs text-amber-700">(kritisch)</span>
                  ) : null}
                </label>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Aktion: <strong>{active.action_type}</strong> · Match:{" "}
                {active.match_type}
              </p>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-forest">
                  Pattern (keyword/regex)
                </span>
                <textarea
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 font-mono text-sm"
                />
              </label>

              <div className="mt-6 rounded-2xl border border-dashed border-gray-100 bg-gray-50 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-forest">
                  <FlaskConical size={14} /> Schnelltest
                </p>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Tesphrase eingeben — leer = Testphrases der Regel"
                  rows={2}
                  className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void runTest()}
                  className="mt-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-forest"
                >
                  Testen
                </button>
                {testResult ? (
                  <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-700">
                    {testResult}
                  </pre>
                ) : null}
              </div>
            </>
          ) : null}
        </section>

        <aside className="rounded-3xl border border-gray-100 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Releases
          </p>
          <ul className="mt-3 space-y-2">
            {releases.length === 0 ? (
              <li className="text-sm text-gray-500">Noch kein Release.</li>
            ) : (
              releases.map((r) => (
                <li key={r.id} className="rounded-2xl border border-gray-50 px-3 py-2">
                  <p className="truncate text-sm font-medium text-forest">
                    {r.label || r.id.slice(0, 8)}
                    {r.is_active ? (
                      <span className="ml-2 text-[10px] uppercase text-aqua-deep">
                        aktiv
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {new Date(r.published_at).toLocaleString("de-DE")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
