"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Contact } from "@/lib/crm/types";
import { Flash, OpsPage, PageHeader } from "@/components/ops/ui";

export function CustomersList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/crm/contacts", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
        if (!cancelled) setContacts(data.contacts ?? []);
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

  const filtered = contacts.filter((c) => {
    if (!q.trim()) return true;
    const hay = `${c.display_name} ${c.kind} ${c.customer_status}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <OpsPage>
      <PageHeader
        eyebrow="CRM"
        title="Kunden"
        description="Kontakte mit Timeline."
        actions={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen…"
            className="w-40 rounded-full border border-gray-100 bg-white px-3 py-2 text-sm sm:w-56"
          />
        }
      />

      {error ? <Flash tone="error">{error}</Flash> : null}

      {loading ? (
        <div className="flex justify-center text-gray-400">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500">
          Keine Kunden. Entstehen aus der Inbox.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Typ</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/crm/kunden/${c.id}`}
                      className="font-medium text-forest hover:underline"
                    >
                      {c.display_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{c.kind}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    {c.customer_status}
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
