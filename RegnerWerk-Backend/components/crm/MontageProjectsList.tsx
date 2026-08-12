"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { MontageProject } from "@/lib/crm/types";

type Row = MontageProject & { contact_name: string | null };

export function MontageProjectsList() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/crm/montage", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
        if (!cancelled) setProjects(data.projects ?? []);
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-forest">
        Montageprojekte
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Installationsprojekte nach gewonnenen Deals (nicht Sofort-Konfigurator).
      </p>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <div className="mt-10 flex justify-center text-gray-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : projects.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-500">
          Noch keine Montageprojekte. Setze eine Pipeline-Chance auf{" "}
          <strong>Won</strong>.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-3xl border border-gray-100 bg-white">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/crm/montageprojekte/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-forest">
                    {p.project_number} · {p.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {p.contact_name || "Ohne Kunde"} · {p.status}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  {p.next_action || "Keine nächste Aktion"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
