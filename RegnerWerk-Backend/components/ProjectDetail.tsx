"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileDown, Loader2 } from "lucide-react";

type CalcLogEntry = {
  timestamp: string;
  algorithm: string;
  brand: string;
  lawnCount: number;
  totalAreaM2: number;
  headCount: number;
  zoneCount: number;
  zones: Array<{
    id: string;
    headCount: number;
    flowLpm: number;
    families: string[];
  }>;
  headsByFamily: Record<string, number>;
};

type ProjectPayload = {
  calcHistory?: CalcLogEntry[];
  sofortPlan?: {
    heads?: Array<{ configKey: string; hydraulicZone: number }>;
    brand?: string;
    algorithmVersion?: string;
    lawnAreaM2?: number;
    coveragePct?: number;
    totalKnownEur?: number;
  } | null;
  [key: string]: unknown;
};

type Project = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  place_label: string;
  customer_email: string | null;
  customer_name: string | null;
  payload: ProjectPayload;
  pdf_path: string | null;
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

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setProject(data.project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-forest/40">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/projekte"
          className="mb-4 inline-flex items-center gap-1 text-sm text-forest/60 hover:text-forest"
        >
          <ArrowLeft size={14} /> Zurück
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "Projekt nicht gefunden"}
        </div>
      </div>
    );
  }

  const plan = project.payload.sofortPlan;
  const history = project.payload.calcHistory ?? [];
  const frontendBase =
    process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3002";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/projekte"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-forest/60 hover:text-forest"
      >
        <ArrowLeft size={14} /> Alle Projekte
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest">
            {project.place_label || "Ohne Adresse"}
          </h1>
          <p className="mt-1 text-xs text-forest/40 font-mono">{project.id}</p>
          <p className="mt-2 flex flex-wrap gap-3 text-sm text-forest/60">
            <span>{formatDate(project.created_at)}</span>
            {project.customer_name && <span>{project.customer_name}</span>}
            {project.customer_email && <span>{project.customer_email}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              project.status === "submitted"
                ? "bg-lime/20 text-forest"
                : "bg-forest/8 text-forest/55"
            }`}>
              {project.status}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${frontendBase}/konfigurator?projectId=${encodeURIComponent(project.id)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest/90"
          >
            <ExternalLink size={13} /> Öffnen
          </a>
          {project.pdf_path && (
            <a
              href={`/api/projects/${project.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 bg-white px-3 py-2 text-xs font-medium text-forest hover:bg-mint"
            >
              <FileDown size={13} /> PDF
            </a>
          )}
        </div>
      </div>

      {plan && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Algorithmus", value: plan.algorithmVersion ?? "—" },
            { label: "Marke", value: plan.brand ?? "—" },
            { label: "Rasenfläche", value: plan.lawnAreaM2 ? `${Math.round(plan.lawnAreaM2)} m²` : "—" },
            { label: "Abdeckung", value: plan.coveragePct ? `${plan.coveragePct} %` : "—" },
            { label: "Regner", value: plan.heads?.length ?? "—" },
            { label: "Gesamt", value: plan.totalKnownEur != null ? `${plan.totalKnownEur.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}` : "—" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-forest/10 bg-white px-3 py-2.5"
            >
              <p className="text-[10px] uppercase tracking-wider text-forest/40">
                {s.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-forest">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-bold tracking-tight text-forest">
          Berechnungsverlauf
        </h2>
        <p className="mt-1 text-xs text-forest/50">
          Alle Berechnungen, die der Nutzer im Konfigurator durchgeführt hat.
        </p>

        {history.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-forest/15 bg-mint/20 px-4 py-8 text-center text-sm text-forest/50">
            Kein Berechnungsverlauf vorhanden. Verlauf wird bei neuen Berechnungen gespeichert.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-forest/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-forest/8 bg-mint/30 text-left text-[11px] uppercase tracking-wider text-forest/50">
                  <th className="px-3 py-2">Zeitstempel</th>
                  <th className="px-3 py-2">Algo</th>
                  <th className="px-3 py-2">Marke</th>
                  <th className="px-3 py-2">Fläche</th>
                  <th className="px-3 py-2">Regner</th>
                  <th className="px-3 py-2">Zonen</th>
                  <th className="px-3 py-2">Familien</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/5">
                {history.map((entry, i) => (
                  <tr key={i} className="hover:bg-mint/10">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-forest/60">
                      {formatDate(entry.timestamp)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.algorithm}</td>
                    <td className="px-3 py-2 text-xs capitalize">{entry.brand}</td>
                    <td className="px-3 py-2 text-xs">
                      {Math.round(entry.totalAreaM2)} m²
                    </td>
                    <td className="px-3 py-2 text-xs">{entry.headCount}</td>
                    <td className="px-3 py-2 text-xs">{entry.zoneCount}</td>
                    <td className="px-3 py-2 text-xs">
                      {Object.entries(entry.headsByFamily)
                        .map(([fam, count]) => `${count}× ${fam}`)
                        .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
