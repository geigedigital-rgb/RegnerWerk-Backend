"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Flash,
  OpsPage,
  PageHeader,
  Panel,
} from "@/components/ops/ui";

type Call = {
  id: string;
  created_at: string;
  from_number_e164: string | null;
  status: string;
  outcome: string | null;
  match_status: string;
  duration_seconds: number | null;
  summary: string | null;
};

export function CallsList() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<
    Array<{ event_type: string; occurred_at: string; sequence: number }>
  >([]);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/ai/calls", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setCalls(data.calls ?? []);
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
    if (!selected) return;
    let cancelled = false;
    async function loadDetail() {
      const res = await fetch(`/api/ai/calls/${selected}`, { cache: "no-store" });
      const data = await res.json();
      if (!cancelled && res.ok) setEvents(data.events ?? []);
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (loading) {
    return (
      <OpsPage>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Laden…
        </div>
      </OpsPage>
    );
  }

  return (
    <OpsPage>
      <PageHeader
        eyebrow="Betrieb"
        title="Anrufe"
        description="Historie ohne Aufnahme."
        actions={
          <Link
            href="/ai/live"
            className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-forest"
          >
            Live
          </Link>
        }
      />

      {error ? <Flash tone="error">{error}</Flash> : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Zeit</th>
                <th className="px-3 py-2 font-semibold">Von</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Dauer</th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                    Noch keine Anrufe.
                  </td>
                </tr>
              ) : (
                calls.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={cn(
                      "cursor-pointer border-b border-gray-50 hover:bg-gray-50",
                      selected === c.id && "bg-mint/50",
                    )}
                  >
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {new Date(c.created_at).toLocaleString("de-DE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-forest">
                      {c.from_number_e164 || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {c.status}
                      {c.outcome ? ` · ${c.outcome}` : ""}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      {c.duration_seconds != null ? `${c.duration_seconds}s` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Panel title="Detail">
          {selected ? (
            <>
              <ul className="space-y-1.5">
                {events.map((e) => (
                  <li key={`${e.sequence}-${e.event_type}`} className="text-xs">
                    <span className="font-medium text-forest">{e.event_type}</span>
                    <span className="ml-1 text-gray-400">
                      {new Date(e.occurred_at).toLocaleTimeString("de-DE")}
                    </span>
                  </li>
                ))}
              </ul>
              {calls.find((c) => c.id === selected)?.summary ? (
                <p className="mt-3 text-xs text-gray-600">
                  {calls.find((c) => c.id === selected)?.summary}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-gray-500">Zeile wählen.</p>
          )}
        </Panel>
      </div>
    </OpsPage>
  );
}
