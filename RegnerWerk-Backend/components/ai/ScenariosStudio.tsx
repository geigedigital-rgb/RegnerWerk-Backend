"use client";

import { useEffect, useState } from "react";
import { Loader2, Rocket, Save } from "lucide-react";
import { cn } from "@/lib/cn";

type Scenario = {
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
};

type Release = {
  id: string;
  label: string | null;
  compiled_hash: string;
  published_at: string;
  is_active: boolean;
};

export function ScenariosStudio() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hints, setHints] = useState("");
  const [fields, setFields] = useState("");
  const [forbidden, setForbidden] = useState("");
  const [priority, setPriority] = useState(100);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0] ?? null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/scenarios", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setScenarios(data.scenarios ?? []);
      setReleases(data.releases ?? []);
      if (!activeId && data.scenarios?.[0]) setActiveId(data.scenarios[0].id);
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
    setDescription(active.description ?? "");
    setHints(active.intent_hints.join(", "));
    setFields(active.required_fields.join(", "));
    setForbidden(active.forbidden_actions.join(", "));
    setPriority(active.priority);
  }, [active?.id]);

  async function save() {
    if (!active) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/ai/scenarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: active.id,
          name,
          description,
          priority,
          intent_hints: hints.split(",").map((s) => s.trim()).filter(Boolean),
          required_fields: fields.split(",").map((s) => s.trim()).filter(Boolean),
          forbidden_actions: forbidden
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      setOk("Gespeichert");
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
      const res = await fetch("/api/ai/scenarios/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeComment: "Publish from Szenarien" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish fehlgeschlagen");
      setOk(`Release: ${data.release?.compiled_hash?.slice(0, 12)}…`);
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
        <Loader2 size={16} className="animate-spin" /> Szenarien laden…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-aqua-deep">
            KI-Assistent · §15
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-forest">
            Szenarien
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600">
            Gesprächsstruktur ohne starres Voice-Menü — Steps, Pflichtfelder, Verbote.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
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

      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_240px]">
        <aside className="rounded-3xl border border-gray-100 bg-white p-3">
          <ul className="max-h-[70vh] space-y-0.5 overflow-auto">
            {scenarios.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={cn(
                    "w-full rounded-2xl px-3 py-2 text-left",
                    active?.id === s.id ? "bg-mint" : "hover:bg-gray-50",
                  )}
                >
                  <p className="truncate text-sm font-medium text-forest">{s.name}</p>
                  <p className="text-[11px] text-gray-400">
                    P{s.priority} · {s.code}
                  </p>
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
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-forest">
                  Beschreibung
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-forest">
                  Priorität
                </span>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-forest">
                  Intent-Hinweise (Komma)
                </span>
                <input
                  value={hints}
                  onChange={(e) => setHints(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-forest">
                  Pflichtfelder (Komma)
                </span>
                <input
                  value={fields}
                  onChange={(e) => setFields(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-sm font-medium text-forest">
                  Verbotene Aktionen (Komma)
                </span>
                <input
                  value={forbidden}
                  onChange={(e) => setForbidden(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
                />
              </label>
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Steps
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                  {active.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
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
                <li key={r.id} className="rounded-2xl border border-gray-50 px-3 py-2 text-sm">
                  <p className="font-medium text-forest">
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
