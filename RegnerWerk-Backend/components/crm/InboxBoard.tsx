"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import type { InboxItem, RequestType } from "@/lib/crm/types";

const REQUEST_TYPES: Array<{ value: RequestType; label: string }> = [
  { value: "new_installation", label: "Neuanlage" },
  { value: "repair", label: "Reparatur" },
  { value: "extension", label: "Erweiterung" },
  { value: "maintenance", label: "Wartung" },
  { value: "winterization", label: "Einwinterung" },
  { value: "other", label: "Sonstiges" },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function InboxBoard() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    summary: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    postal_code: "",
    request_type: "new_installation" as RequestType,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/inbox?status=open", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "accept" | "reject" | "spam") {
    let reason: string | undefined;
    if (action === "reject") {
      reason = window.prompt("Grund für Ablehnung?") ?? undefined;
      if (!reason?.trim()) return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/crm/inbox/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Aktion fehlgeschlagen");
      if (action === "accept" && data.lead?.id) {
        window.location.href = `/crm/leads/${data.lead.id}`;
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusyId(null);
    }
  }

  async function createManual(e: React.FormEvent) {
    e.preventDefault();
    setBusyId("create");
    try {
      const res = await fetch("/api/crm/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source_type: "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Anlegen fehlgeschlagen");
      setShowForm(false);
      setForm({
        summary: "",
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        postal_code: "",
        request_type: "new_installation",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-aqua-deep">
            CRM
          </p>
          <h1 className="text-xl font-bold tracking-tight text-forest sm:text-2xl">
            Inbox
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={14} />
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
          onSubmit={createManual}
          className="mt-6 space-y-3 rounded-3xl border border-gray-100 bg-white p-5"
        >
          <p className="text-sm font-semibold text-forest">Manueller Eintrag</p>
          <textarea
            required
            rows={3}
            placeholder="Kurzbeschreibung / Anliegen"
            className="w-full rounded-2xl border border-gray-100 px-3 py-2 text-sm"
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Name"
              className="rounded-2xl border border-gray-100 px-3 py-2 text-sm"
              value={form.contact_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_name: e.target.value }))
              }
            />
            <input
              placeholder="Telefon"
              className="rounded-2xl border border-gray-100 px-3 py-2 text-sm"
              value={form.contact_phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_phone: e.target.value }))
              }
            />
            <input
              placeholder="E-Mail"
              className="rounded-2xl border border-gray-100 px-3 py-2 text-sm"
              value={form.contact_email}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_email: e.target.value }))
              }
            />
            <input
              placeholder="PLZ"
              className="rounded-2xl border border-gray-100 px-3 py-2 text-sm"
              value={form.postal_code}
              onChange={(e) =>
                setForm((f) => ({ ...f, postal_code: e.target.value }))
              }
            />
            <select
              className="rounded-2xl border border-gray-100 px-3 py-2 text-sm sm:col-span-2"
              value={form.request_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  request_type: e.target.value as RequestType,
                }))
              }
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busyId === "create"}
            className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Speichern
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-10 flex justify-center text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-500">
          Inbox leer. Lege einen manuellen Eintrag an oder warte auf Website-/Anruf-Events.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-3xl border border-gray-100 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span className="rounded-full bg-mint px-2 py-0.5 font-medium text-aqua-deep">
                      {item.source_type}
                    </span>
                    <span>{formatDate(item.created_at)}</span>
                    {item.priority !== "normal" ? (
                      <span className="font-medium text-amber-700">
                        {item.priority}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-medium text-forest">
                    {item.contact_name || item.contact_phone || "Ohne Namen"}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{item.summary}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {[item.contact_phone, item.contact_email, item.postal_code]
                      .filter(Boolean)
                      .join(" · ") || "Keine Kontaktdaten"}
                    {item.suggested_contact_id ? (
                      <>
                        {" · "}
                        <Link
                          href={`/crm/kunden/${item.suggested_contact_id}`}
                          className="text-aqua-deep hover:underline"
                        >
                          möglicher Kunde
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void act(item.id, "accept")}
                    className="rounded-full bg-lime px-3 py-1.5 text-xs font-medium text-forest disabled:opacity-50"
                  >
                    Als Lead
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void act(item.id, "reject")}
                    className="rounded-full border border-gray-100 px-3 py-1.5 text-xs text-gray-600 disabled:opacity-50"
                  >
                    Ablehnen
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void act(item.id, "spam")}
                    className="rounded-full border border-gray-100 px-3 py-1.5 text-xs text-gray-400 disabled:opacity-50"
                  >
                    Spam
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
