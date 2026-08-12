"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Contact, MontageProject, MontageProjectStatus } from "@/lib/crm/types";

const STATUSES: MontageProjectStatus[] = [
  "handover",
  "planning",
  "scheduled",
  "installation",
  "commissioning",
  "documentation",
  "first_season",
  "completed",
  "paused",
  "cancelled",
];

type Props = { projectId: string };

export function MontageProjectDetail({ projectId }: Props) {
  const [project, setProject] = useState<MontageProject | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/montage/${projectId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setProject(data.project);
      setContact(data.contact);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(status: MontageProjectStatus) {
    if (!project) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/crm/montage/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      setProject(data.project);
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
  if (!project) {
    return <p className="p-8 text-sm text-gray-500">{error || "Nicht gefunden"}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/crm/montageprojekte"
        className="text-xs text-aqua-deep hover:underline"
      >
        ← Montageprojekte
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-forest">
        {project.project_number}
      </h1>
      <p className="mt-1 text-sm text-gray-600">{project.name}</p>
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
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <section className="mt-6 rounded-3xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold text-forest">Status</h2>
        <p className="mt-1 text-sm text-gray-600">{project.status}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy || s === project.status}
              onClick={() => void setStatus(s)}
              className="rounded-full border border-gray-100 px-3 py-1 text-xs text-gray-600 disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-600">
          Nächste Aktion: {project.next_action || "—"}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {project.scope_summary || "Kein Scope hinterlegt"}
        </p>
        {project.opportunity_id ? (
          <p className="mt-4 text-xs">
            <Link
              href={`/crm/pipeline/${project.opportunity_id}`}
              className="text-aqua-deep hover:underline"
            >
              Zur Opportunity
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
