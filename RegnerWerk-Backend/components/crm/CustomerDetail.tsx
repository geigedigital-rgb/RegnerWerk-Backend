"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type {
  Contact,
  ContactChannel,
  Lead,
  Task,
  TimelineEvent,
} from "@/lib/crm/types";

type Props = { contactId: string };

type ContactProject = {
  id: string;
  created_at: string;
  status: string;
  place_label: string;
  pdf_path: string | null;
  head_count: number | null;
  lawn_area_m2: number | null;
  total_eur: number | null;
  openUrl: string;
  pdfUrl: string;
};

export function CustomerDetail({ contactId }: Props) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [channels, setChannels] = useState<ContactChannel[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<ContactProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/crm/contacts/${contactId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
        if (cancelled) return;
        setContact(data.contact);
        setChannels(data.channels ?? []);
        setTimeline(data.timeline ?? []);
        setTasks(data.tasks ?? []);
        setLeads(data.leads ?? []);
        setProjects(data.projects ?? []);
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
  }, [contactId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  if (!contact) {
    return (
      <p className="px-6 py-12 text-sm text-gray-500">
        {error || "Kunde nicht gefunden"}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/crm/kunden" className="text-xs text-aqua-deep hover:underline">
        ← Kunden
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-forest">
        {contact.display_name}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {contact.kind} · {contact.customer_status}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-forest">Kanäle</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {channels.map((ch) => (
              <li key={ch.id} className="flex justify-between gap-2">
                <span className="text-gray-400">{ch.type}</span>
                <span className="font-medium text-forest">{ch.value_raw}</span>
              </li>
            ))}
            {channels.length === 0 ? (
              <li className="text-xs text-gray-400">Keine Kanäle</li>
            ) : null}
          </ul>
        </section>
        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-forest">Leads</h2>
          <ul className="mt-3 space-y-2">
            {leads.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/crm/leads/${l.id}`}
                  className="text-sm text-aqua-deep hover:underline"
                >
                  {l.summary_current || l.status}
                </Link>
              </li>
            ))}
            {leads.length === 0 ? (
              <li className="text-xs text-gray-400">Keine Leads</li>
            ) : null}
          </ul>
          <h2 className="mt-5 text-sm font-bold text-forest">Offene Aufgaben</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            {tasks.map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
            {tasks.length === 0 ? (
              <li className="text-xs text-gray-400">Keine</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="mt-4 rounded-3xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold text-forest">Konfigurator-Projekte</h2>
        <ul className="mt-3 space-y-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-forest">
                  {p.place_label || "Ohne Adresse"}
                </p>
                <p className="text-[11px] text-gray-400">
                  {new Date(p.created_at).toLocaleString("de-DE")} · {p.status}
                  {p.lawn_area_m2 != null
                    ? ` · ${Math.round(p.lawn_area_m2)} m²`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {p.pdf_path ? (
                  <a
                    href={p.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-gray-200 px-2.5 py-1 text-xs font-medium text-forest hover:bg-mint"
                  >
                    PDF
                  </a>
                ) : null}
                <a
                  href={p.openUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-forest px-2.5 py-1 text-xs font-medium text-white hover:bg-forest/90"
                >
                  Konfigurator
                </a>
              </div>
            </li>
          ))}
          {projects.length === 0 ? (
            <li className="text-xs text-gray-400">
              Noch kein gespeichertes Konfigurator-Projekt
            </li>
          ) : null}
        </ul>
      </section>

      <section className="mt-4 rounded-3xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold text-forest">Timeline</h2>
        <ul className="mt-3 space-y-3">
          {timeline.map((ev) => (
            <li key={ev.id} className="border-l-2 border-mint pl-3">
              <p className="text-sm font-medium text-forest">{ev.title}</p>
              {ev.summary ? (
                <p className="text-xs text-gray-500">{ev.summary}</p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-gray-400">
                {new Date(ev.occurred_at).toLocaleString("de-DE")} · {ev.actor_type}
              </p>
            </li>
          ))}
          {timeline.length === 0 ? (
            <li className="text-xs text-gray-400">Noch keine Ereignisse</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
