"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Contact, Lead, Task, TimelineEvent } from "@/lib/crm/types";

type Props = { leadId: string };

export function LeadDetail({ leadId }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextAction, setNextAction] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setLead(data.lead);
      setContact(data.contact);
      setTimeline(data.timeline ?? []);
      setTasks(data.tasks ?? []);
      setNextAction(data.lead?.next_action ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNextAction() {
    if (!lead) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next_action: nextAction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      setLead(data.lead);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function convertToPipeline() {
    if (!lead) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/convert`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Konvertierung fehlgeschlagen");
      if (data.opportunity?.id) {
        window.location.href = `/crm/pipeline/${data.opportunity.id}`;
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function createService() {
    if (!lead) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/service`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Servicefall fehlgeschlagen");
      if (data.serviceCase?.id) {
        window.location.href = `/crm/service/${data.serviceCase.id}`;
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !taskTitle.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          type: "callback",
          related_lead_id: lead.id,
          related_contact_id: lead.contact_id,
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Aufgabe fehlgeschlagen");
      setTaskTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
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

  if (!lead) {
    return (
      <p className="px-6 py-12 text-sm text-gray-500">
        {error || "Lead nicht gefunden"}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/crm/leads" className="text-xs text-aqua-deep hover:underline">
        ← Leads
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-forest">
        Lead
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {lead.status} · {lead.source} · {lead.request_type || "ohne Typ"}
      </p>

      {lead.status === "converted" && lead.converted_opportunity_id ? (
        <p className="mt-3 text-sm">
          <Link
            href={`/crm/pipeline/${lead.converted_opportunity_id}`}
            className="font-medium text-aqua-deep hover:underline"
          >
            Zur Pipeline-Chance →
          </Link>
        </p>
      ) : lead.status !== "unqualified" &&
        lead.status !== "archived" &&
        lead.contact_id ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void convertToPipeline()}
            className="rounded-full bg-lime px-4 py-2 text-sm font-medium text-forest disabled:opacity-50"
          >
            In Pipeline übernehmen
          </button>
          {(lead.request_type === "repair" ||
            lead.request_type === "maintenance" ||
            lead.request_type === "winterization" ||
            lead.request_type === "extension") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void createService()}
              className="rounded-full border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-forest disabled:opacity-50"
            >
              Als Servicefall
            </button>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-forest">Zusammenfassung</h2>
          <p className="mt-2 text-sm text-gray-600">
            {lead.summary_current || lead.description_original || "—"}
          </p>
          {contact ? (
            <p className="mt-4 text-sm">
              Kunde:{" "}
              <Link
                href={`/crm/kunden/${contact.id}`}
                className="font-medium text-aqua-deep hover:underline"
              >
                {contact.display_name}
              </Link>
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Nächste Aktion
            </label>
            <input
              className="w-full rounded-2xl border border-gray-100 px-3 py-2 text-sm"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveNextAction()}
              className="rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-forest">Aufgabe anlegen</h2>
          <form onSubmit={createTask} className="mt-3 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-2xl border border-gray-100 px-3 py-2 text-sm"
              placeholder="z. B. Rückruf morgen"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !taskTitle.trim()}
              className="rounded-full bg-lime px-3 py-2 text-xs font-medium text-forest disabled:opacity-50"
            >
              +
            </button>
          </form>
          <ul className="mt-4 space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="rounded-xl bg-gray-50 px-3 py-2 text-sm">
                <p className="font-medium text-forest">{t.title}</p>
                <p className="text-xs text-gray-400">{t.status}</p>
              </li>
            ))}
            {tasks.length === 0 ? (
              <li className="text-xs text-gray-400">Keine offenen Aufgaben</li>
            ) : null}
          </ul>
        </section>
      </div>

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
