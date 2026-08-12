"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type {
  Contact,
  ServiceCase,
  ServiceCaseStatus,
  TimelineEvent,
} from "@/lib/crm/types";

const STATUSES: ServiceCaseStatus[] = [
  "new",
  "triage",
  "scheduled",
  "in_progress",
  "waiting_customer",
  "waiting_parts",
  "resolved",
  "closed",
];

type Props = { caseId: string };

export function ServiceCaseDetail({ caseId }: Props) {
  const [serviceCase, setServiceCase] = useState<ServiceCase | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/service/${caseId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setServiceCase(data.serviceCase);
      setContact(data.contact);
      setTimeline(data.timeline ?? []);
      setResolution(data.serviceCase?.resolution_summary ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    if (!serviceCase) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/service/${serviceCase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setServiceCase(data.serviceCase);
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
  if (!serviceCase) {
    return <p className="p-8 text-sm text-gray-500">{error || "Nicht gefunden"}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/crm/service" className="text-xs text-aqua-deep hover:underline">
        ← Service
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-forest">
        {serviceCase.case_number}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {serviceCase.title || serviceCase.type} · {serviceCase.status} ·{" "}
        {serviceCase.urgency}
      </p>
      {contact ? (
        <p className="mt-2 text-sm">
          <Link
            href={`/crm/kunden/${contact.id}`}
            className="text-aqua-deep hover:underline"
          >
            {contact.display_name}
          </Link>
        </p>
      ) : null}
      {serviceCase.safety_flags?.length ? (
        <p className="mt-2 text-sm font-medium text-red-700">
          Safety: {serviceCase.safety_flags.join(", ")}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <section className="mt-6 rounded-3xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold text-forest">Problem</h2>
        <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
          {serviceCase.problem_description}
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Nächste Aktion: {serviceCase.next_action || "—"}
        </p>
      </section>

      <section className="mt-4 rounded-3xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold text-forest">Status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy || s === serviceCase.status}
              onClick={() => void patch({ status: s })}
              className="rounded-full border border-gray-100 px-3 py-1 text-xs text-gray-600 disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Lösung / Ergebnis
          </label>
          <textarea
            rows={3}
            className="w-full rounded-2xl border border-gray-100 px-3 py-2 text-sm"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void patch({
                resolution_summary: resolution,
                status: "resolved",
              })
            }
            className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Als resolved speichern
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold text-forest">Timeline (Kunde)</h2>
        <ul className="mt-3 space-y-2">
          {timeline.slice(0, 12).map((ev) => (
            <li key={ev.id} className="border-l-2 border-mint pl-3 text-sm">
              <p className="font-medium text-forest">{ev.title}</p>
              <p className="text-xs text-gray-400">
                {new Date(ev.occurred_at).toLocaleString("de-DE")}
              </p>
            </li>
          ))}
          {timeline.length === 0 ? (
            <li className="text-xs text-gray-400">Keine Ereignisse</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
