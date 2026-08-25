"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Copy,
  ExternalLink,
  FileDown,
  FolderOpen,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
} from "lucide-react";

type ProjectListItem = {
  id: string;
  created_at: string;
  updated_at: string;
  status: "submitted" | "draft";
  place_id: string;
  place_label: string;
  customer_email: string | null;
  customer_name: string | null;
  pdf_path: string | null;
  parent_id: string | null;
  contact_id: string | null;
  head_count: number | null;
  lawn_area_m2: number | null;
  total_eur: number | null;
};

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

function euro(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function ProjectsList() {
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const frontendUrl =
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    (typeof window !== "undefined" ? "" : "http://localhost:3002");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setItems(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openUrl(id: string) {
    const base =
      (process.env.NEXT_PUBLIC_FRONTEND_URL || "").replace(/\/$/, "") ||
      "http://localhost:3002";
    return `${base}/konfigurator?projectId=${encodeURIComponent(id)}`;
  }

  async function onDuplicate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duplizieren fehlgeschlagen");
      await load();
      if (data.openUrl) window.open(data.openUrl, "_blank");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Projekt wirklich löschen?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusyId(null);
    }
  }

  function onPdf(id: string) {
    window.open(`/api/projects/${id}/pdf`, "_blank");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projekte</h1>
          <p className="mt-1 text-sm text-forest/55">
            Gespeicherte Sofort-Berechnungen aus dem Konfigurator
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-forest/15 bg-white px-3 py-2 text-sm font-medium text-forest hover:bg-mint"
        >
          <RefreshCw size={14} />
          Aktualisieren
        </button>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center text-forest/40">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : null}

      {error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <p className="mt-2 text-xs text-red-600/80">
            Prüfe Supabase-Env und ob die SQL-Migration ausgeführt wurde.
          </p>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-forest/20 bg-mint/30 px-6 py-12 text-center">
          <FolderOpen className="mx-auto text-forest/30" size={36} />
          <p className="mt-3 text-sm text-forest/60">
            Noch keine Projekte. Im Konfigurator nach der Sofort-Berechnung
            „Projekt per E-Mail senden“ nutzen.
          </p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="mt-8 divide-y divide-forest/8 overflow-hidden rounded-2xl border border-forest/10 bg-white">
          {items.map((p) => {
            const busy = busyId === p.id;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/projekte/${p.id}`}
                      className="truncate text-[15px] font-semibold text-forest hover:text-aqua-deep hover:underline"
                    >
                      {p.place_label || p.place_id || "Ohne Adresse"}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        p.status === "submitted"
                          ? "bg-lime/20 text-forest"
                          : "bg-forest/8 text-forest/55"
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.parent_id ? (
                      <span className="text-[10px] text-forest/40">Kopie</span>
                    ) : null}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-forest/50">
                    <span>{formatDate(p.created_at)}</span>
                    {p.customer_name ? <span>{p.customer_name}</span> : null}
                    {p.customer_email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail size={11} />
                        {p.contact_id ? (
                          <Link
                            href={`/crm/kunden/${p.contact_id}`}
                            className="text-aqua-deep hover:underline"
                          >
                            {p.customer_email}
                          </Link>
                        ) : (
                          p.customer_email
                        )}
                      </span>
                    ) : null}
                    {p.head_count != null ? (
                      <span>{p.head_count} Regner</span>
                    ) : null}
                    {p.lawn_area_m2 != null ? (
                      <span>{Math.round(p.lawn_area_m2)} m²</span>
                    ) : null}
                    <span>{euro(p.total_eur)}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-forest/30">
                    {p.id}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={openUrl(p.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest/90"
                  >
                    <ExternalLink size={13} />
                    Öffnen
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onDuplicate(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 bg-white px-3 py-2 text-xs font-medium text-forest hover:bg-mint disabled:opacity-50"
                  >
                    <Copy size={13} />
                    Duplizieren
                  </button>
                  <button
                    type="button"
                    onClick={() => onPdf(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 bg-white px-3 py-2 text-xs font-medium text-forest hover:bg-mint"
                  >
                    <FileDown size={13} />
                    PDF
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onDelete(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    Löschen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* silence unused */}
      <span className="hidden">{frontendUrl}</span>
    </div>
  );
}
