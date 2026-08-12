"use client";

import { useEffect, useState } from "react";
import { Loader2, Rocket, Save, Shield } from "lucide-react";
import { cn } from "@/lib/cn";

type ToolEntry = {
  tool_name: string;
  autonomy: string;
  args_schema_note?: string;
};

type Assistant = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  role: string;
  is_default: boolean;
  draft: {
    id: string;
    version: number;
    status: string;
    configuration: Record<string, unknown>;
  } | null;
  published: {
    id: string;
    version: number;
    status: string;
    configuration: Record<string, unknown>;
    published_at: string | null;
  } | null;
};

type ToolPolicy = {
  id: string;
  code: string;
  name: string;
  published: { tools: ToolEntry[]; version: number } | null;
};

export function AssistantsStudio() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [policies, setPolicies] = useState<ToolPolicy[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState("gpt-realtime");
  const [voice, setVoice] = useState("alloy");
  const [welcome, setWelcome] = useState("");
  const [policyCode, setPolicyCode] = useState("empfang_default");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const active = assistants.find((a) => a.id === activeId) ?? assistants[0] ?? null;
  const activePolicy = policies.find((p) => p.code === policyCode);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/assistants", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setAssistants(data.assistants ?? []);
      setPolicies(data.toolPolicies ?? []);
      if (!activeId && data.assistants?.[0]) setActiveId(data.assistants[0].id);
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
    const cfg =
      active.draft?.configuration ?? active.published?.configuration ?? {};
    setModel(String(cfg.model ?? "gpt-realtime"));
    setVoice(String(cfg.voice ?? "alloy"));
    setWelcome(String(cfg.welcome_message ?? ""));
    setPolicyCode(String(cfg.tool_policy_code ?? "empfang_default"));
  }, [active?.id, active?.draft?.id]);

  async function save() {
    if (!active) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const base =
        active.draft?.configuration ?? active.published?.configuration ?? {};
      const res = await fetch("/api/ai/assistants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: active.id,
          configuration: {
            ...base,
            model,
            voice,
            welcome_message: welcome,
            tool_policy_code: policyCode,
            use_active_prompt_release: true,
            use_active_rule_release: true,
            use_active_scenario_release: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      setOk("Draft gespeichert");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!active) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const base =
        active.draft?.configuration ?? active.published?.configuration ?? {};
      const saveRes = await fetch("/api/ai/assistants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: active.id,
          configuration: {
            ...base,
            model,
            voice,
            welcome_message: welcome,
            tool_policy_code: policyCode,
            use_active_prompt_release: true,
            use_active_rule_release: true,
            use_active_scenario_release: true,
          },
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Speichern fehlgeschlagen");

      const res = await fetch(`/api/ai/assistants/${active.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish fehlgeschlagen");
      setOk(`Published v${data.version?.version}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-12 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Assistenten laden…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-aqua-deep">
            KI-Assistent · §8.2
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-forest">
            Assistenten
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600">
            Verhaltensbundle: Prompt-/Rule-/Scenario-Releases + Tool Policy.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-forest disabled:opacity-50"
          >
            <Save size={14} /> Draft
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

      <div className="mt-6 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="rounded-3xl border border-gray-100 bg-white p-3">
          <ul className="space-y-0.5">
            {assistants.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(a.id)}
                  className={cn(
                    "w-full rounded-2xl px-3 py-2 text-left",
                    active?.id === a.id ? "bg-mint" : "hover:bg-gray-50",
                  )}
                >
                  <p className="text-sm font-medium text-forest">{a.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {a.code}
                    {a.is_default ? " · default" : ""}
                    {a.published ? ` · pub v${a.published.version}` : " · draft"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          {active ? (
            <>
              <p className="text-xs text-gray-400">
                {active.role} · {active.description}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-forest">
                    Modell
                  </span>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-forest">
                    Voice
                  </span>
                  <input
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium text-forest">
                    Tool Policy
                  </span>
                  <select
                    value={policyCode}
                    onChange={(e) => setPolicyCode(e.target.value)}
                    className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                  >
                    {policies.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-forest">
                  Welcome Message
                </span>
                <textarea
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                />
              </label>
              <p className="mt-3 text-xs text-gray-500">
                Bindet automatisch aktive Prompt-, Rule- und Scenario-Releases beim
                Publish (nach Critical Test Lab).
              </p>
            </>
          ) : null}
        </section>

        <aside className="rounded-3xl border border-gray-100 bg-white p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <Shield size={12} /> Tool Allowlist
            {activePolicy?.published
              ? ` · v${activePolicy.published.version}`
              : ""}
          </p>
          <ul className="mt-3 space-y-2">
            {(activePolicy?.published?.tools ?? []).map((t) => (
              <li
                key={t.tool_name}
                className="rounded-2xl border border-gray-50 px-3 py-2 text-sm"
              >
                <p className="font-medium text-forest">{t.tool_name}</p>
                <p
                  className={cn(
                    "text-[11px]",
                    t.autonomy === "deny" ? "text-red-600" : "text-aqua-deep",
                  )}
                >
                  {t.autonomy}
                  {t.args_schema_note ? ` · ${t.args_schema_note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
