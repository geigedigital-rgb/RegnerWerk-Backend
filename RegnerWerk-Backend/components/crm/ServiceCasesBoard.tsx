"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import type {
  Priority,
  ServiceCaseListItem,
  ServiceCaseType,
} from "@/lib/crm/types";

const TYPES: Array<{ value: ServiceCaseType; label: string }> = [
  { value: "repair", label: "Reparatur" },
  { value: "maintenance", label: "Wartung" },
  { value: "winterization", label: "Einwinterung" },
  { value: "spring_start", label: "Frühjahrsstart" },
  { value: "extension", label: "Erweiterung" },
  { value: "first_season", label: "Erste Saison" },
  { value: "other", label: "Sonstiges" },
];

export function ServiceCasesBoard() {
  const [cases, setCases] = useState<ServiceCaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    problem_description: "",
    title: "",
    type: "repair" as ServiceCaseType,
    urgency: "normal" as Priority,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/service?open=1", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setCases(data.cases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/crm/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Anlegen fehlgeschlagen");
      setShowForm(false);
      setForm({
        problem_description: "",
        title: "",
        type: "repair",
        urgency: "normal",
      });
      if (data.serviceCase?.id) {
        window.location.href = `/crm/service/${data.serviceCase.id}`;
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest">
            Service
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Reparatur, Wartung, Einwinterung — mit Dringlichkeit und Safety-Flags.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-sm text-gray-600"
          >
            <RefreshCw size={14} />
            Neu laden
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-sm font-medium text-forest"
          >
            <Plus size={14} />
            Neu
          </button>
        </div>
      </div>

      {showForm ? (
        <form
          onSubmit={create}
          className="mt-6 space-y-3 rounded-3xl border border-gray-100 bg-white p-5"
        >
          <input
            placeholder="Kurzitel (optional)"
            className="w-full rounded-2xl border border-gray-100 px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            required
            rows={3}
            placeholder="Problembeschreibung — bei Rohrbruch/Wasserschaden wird urgent gesetzt"
            className="w-full rounded-2xl border border-gray-100 px-3 py-2 text-sm"
            value={form.problem_description}
            onChange={(e) =>
              setForm((f) => ({ ...f, problem_description: e.target.value }))
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="rounded-2xl border border-gray-100 px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as ServiceCaseType,
                }))
              }
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-gray-100 px-3 py-2 text-sm"
              value={form.urgency}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  urgency: e.target.value as Priority,
                }))
              }
            >
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Anlegen
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="mt-10 flex justify-center text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : cases.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-500">
          Keine offenen Servicefälle.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/crm/service/${c.id}`}
                className="block rounded-3xl border border-gray-100 bg-white p-4 hover:bg-gray-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-forest">
                      {c.case_number} · {c.title || c.type}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {c.contact_name || "Ohne Kunde"} · {c.type} · {c.status}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {c.problem_description}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    {(c.urgency === "urgent" || c.urgency === "high") && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                        {c.urgency}
                      </span>
                    )}
                    {c.safety_flags?.includes("emergency_water") ? (
                      <p className="mt-1 font-medium text-red-700">
                        Wasserschaden/Rohrbruch
                      </p>
                    ) : null}
                    <p className="mt-2 text-gray-400">
                      {c.next_action || "Keine nächste Aktion"}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
