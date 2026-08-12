"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import type { OpportunityListItem, PipelineStage } from "@/lib/crm/types";

export function PipelineBoard() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/pipeline", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setStages(data.stages ?? []);
      setOpportunities(data.opportunities ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byStage = useMemo(() => {
    const map = new Map<string, OpportunityListItem[]>();
    for (const s of stages) map.set(s.id, []);
    for (const o of opportunities) {
      const list = map.get(o.stage_id) ?? [];
      list.push(o);
      map.set(o.stage_id, list);
    }
    return map;
  }, [stages, opportunities]);

  async function move(oppId: string, toStageCode: string) {
    let lossReason: string | undefined;
    if (toStageCode === "lost") {
      lossReason = window.prompt("Verlustgrund?") ?? undefined;
      if (!lossReason?.trim()) return;
    }
    setBusyId(oppId);
    try {
      const res = await fetch(`/api/crm/opportunities/${oppId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move_stage",
          toStageCode,
          lossReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verschieben fehlgeschlagen");
      if (data.montageProject?.id) {
        window.location.href = `/crm/montageprojekte/${data.montageProject.id}`;
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest">
            Pipeline
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Verkaufsphasen — won legt automatisch ein Montageprojekt an.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-sm text-gray-600"
        >
          <RefreshCw size={14} />
          Neu laden
        </button>
      </div>

      {error ? (
        <p className="mx-auto mt-4 max-w-[1400px] text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="mt-16 flex justify-center text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : (
        <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const cards = byStage.get(stage.id) ?? [];
            return (
              <section
                key={stage.id}
                className="flex w-72 shrink-0 flex-col rounded-3xl border border-gray-100 bg-gray-50/80"
              >
                <header className="flex items-center justify-between px-3 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {stage.label_de}
                  </h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-400">
                    {cards.length}
                  </span>
                </header>
                <ul className="flex flex-1 flex-col gap-2 px-2 pb-3">
                  {cards.map((opp) => (
                    <li
                      key={opp.id}
                      className="rounded-2xl border border-gray-100 bg-white p-3 shadow-none"
                    >
                      <Link
                        href={`/crm/pipeline/${opp.id}`}
                        className="text-sm font-medium text-forest hover:underline"
                      >
                        {opp.title || "Ohne Titel"}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">
                        {opp.contact_name || "Ohne Kunde"}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {opp.next_action || "Keine nächste Aktion"}
                      </p>
                      {!stage.is_terminal ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {stages
                            .filter((s) => s.sort_order > stage.sort_order)
                            .slice(0, 2)
                            .map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                disabled={busyId === opp.id}
                                onClick={() => void move(opp.id, s.code)}
                                className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-medium text-aqua-deep disabled:opacity-50"
                              >
                                → {s.label_de}
                              </button>
                            ))}
                          {!stage.is_won && !stage.is_lost ? (
                            <>
                              <button
                                type="button"
                                disabled={busyId === opp.id}
                                onClick={() => void move(opp.id, "won")}
                                className="rounded-full bg-lime/40 px-2 py-0.5 text-[10px] font-medium text-forest disabled:opacity-50"
                              >
                                Won
                              </button>
                              <button
                                type="button"
                                disabled={busyId === opp.id}
                                onClick={() => void move(opp.id, "lost")}
                                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 disabled:opacity-50"
                              >
                                Lost
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                  {cards.length === 0 ? (
                    <li className="px-2 py-6 text-center text-xs text-gray-400">
                      Leer
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
