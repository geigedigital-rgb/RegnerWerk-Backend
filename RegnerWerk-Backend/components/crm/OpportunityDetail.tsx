"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type {
  Contact,
  Opportunity,
  PipelineStage,
} from "@/lib/crm/types";

type Props = { opportunityId: string };

export function OpportunityDetail({ opportunityId }: Props) {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      created_at: string;
      from_label?: string;
      to_label?: string;
      reason: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/opportunities/${opportunityId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setOpportunity(data.opportunity);
      setStage(data.stage);
      setStages(data.stages ?? []);
      setContact(data.contact);
      setHistory(data.history ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(toStageCode: string) {
    let lossReason: string | undefined;
    if (toStageCode === "lost") {
      lossReason = window.prompt("Verlustgrund?") ?? undefined;
      if (!lossReason?.trim()) return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/opportunities/${opportunityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move_stage", toStageCode, lossReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      if (data.montageProject?.id) {
        window.location.href = `/crm/montageprojekte/${data.montageProject.id}`;
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }
  if (!opportunity || !stage) {
    return <p className="p-8 text-sm text-gray-500">{error || "Nicht gefunden"}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/crm/pipeline" className="text-xs text-aqua-deep hover:underline">
        ← Pipeline
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-forest">
        {opportunity.title || "Chance"}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {stage.label_de}
        {contact ? (
          <>
            {" · "}
            <Link
              href={`/crm/kunden/${contact.id}`}
              className="text-aqua-deep hover:underline"
            >
              {contact.display_name}
            </Link>
          </>
        ) : null}
      </p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <section className="mt-6 rounded-3xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold text-forest">Nächste Aktion</h2>
        <p className="mt-2 text-sm text-gray-600">
          {opportunity.next_action || "—"}
        </p>
        <p className="mt-4 text-sm text-gray-600">
          {opportunity.summary || "Keine Zusammenfassung"}
        </p>
        {!stage.is_terminal ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {stages
              .filter((s) => s.id !== stage.id)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void move(s.code)}
                  className="rounded-full border border-gray-100 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {s.label_de}
                </button>
              ))}
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-3xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold text-forest">Stufenverlauf</h2>
        <ul className="mt-3 space-y-2">
          {history.map((h) => (
            <li key={h.id} className="border-l-2 border-mint pl-3 text-sm">
              <p className="font-medium text-forest">
                {h.from_label || "Start"} → {h.to_label}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(h.created_at).toLocaleString("de-DE")}
                {h.reason ? ` · ${h.reason}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
