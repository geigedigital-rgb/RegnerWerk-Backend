"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Lead } from "@/lib/crm/types";
import { Flash, OpsPage, PageHeader } from "@/components/ops/ui";

export function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/crm/leads", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
        if (!cancelled) setLeads(data.leads ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Fehler");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <OpsPage>
      <PageHeader
        eyebrow="CRM"
        title="Leads"
        description="Qualifikation — getrennt vom Kundenstamm."
        actions={
          <Link
            href="/crm/inbox"
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-forest"
          >
            Inbox
          </Link>
        }
      />

      {error ? <Flash tone="error">{error}</Flash> : null}

      {loading ? (
        <div className="flex justify-center text-gray-400">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : leads.length === 0 ? (
        <p className="text-center text-sm text-gray-500">
          Noch keine Leads. Übernimm einen Inbox-Eintrag.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Lead</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Nächste Aktion</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/crm/leads/${lead.id}`}
                      className="font-medium text-forest hover:underline"
                    >
                      {lead.summary_current || "Ohne Text"}
                    </Link>
                    <p className="text-[11px] text-gray-400">{lead.source}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {lead.status}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    {lead.next_action || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OpsPage>
  );
}
