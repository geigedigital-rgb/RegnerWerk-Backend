"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Flash, OpsPage, PageHeader, Panel } from "@/components/ops/ui";

type ReleaseRow = {
  id: string;
  label?: string | null;
  compiled_hash?: string;
  published_at?: string;
  is_active?: boolean;
  version?: number;
  status?: string;
  change_note?: string | null;
  ai_assistants?:
    | { code: string; name: string }
    | { code: string; name: string }[]
    | null;
};

function Block({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: ReleaseRow[];
}) {
  return (
    <Panel
      title={title}
      action={
        <Link href={href} className="text-[10px] text-aqua-deep hover:underline">
          öffnen
        </Link>
      }
    >
      <ul className="space-y-1.5">
        {rows.length === 0 ? (
          <li className="text-sm text-gray-500">Leer</li>
        ) : (
          rows.slice(0, 5).map((r) => {
            const assistant = Array.isArray(r.ai_assistants)
              ? r.ai_assistants[0]
              : r.ai_assistants;
            return (
              <li key={r.id} className="text-sm">
                <p className="font-medium text-forest">
                  {assistant
                    ? `${assistant.name} v${r.version}`
                    : r.label || r.id.slice(0, 8)}
                  {r.is_active ? (
                    <span className="ml-1 text-[9px] uppercase text-aqua-deep">
                      aktiv
                    </span>
                  ) : null}
                  {r.status === "draft" ? (
                    <span className="ml-1 text-[9px] uppercase text-amber-700">
                      draft
                    </span>
                  ) : null}
                </p>
                <p className="text-[10px] text-gray-400">
                  {r.published_at
                    ? new Date(r.published_at).toLocaleString("de-DE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : r.change_note || "—"}
                </p>
              </li>
            );
          })
        )}
      </ul>
    </Panel>
  );
}

export function VersionsOverview() {
  const [data, setData] = useState<{
    prompts: ReleaseRow[];
    rules: ReleaseRow[];
    scenarios: ReleaseRow[];
    assistants: ReleaseRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/ai/releases", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Laden fehlgeschlagen");
        if (!cancelled) setData(json);
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

  if (loading) {
    return (
      <OpsPage>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Laden…
        </div>
      </OpsPage>
    );
  }

  return (
    <OpsPage>
      <PageHeader
        eyebrow="Releases"
        title="Historie"
        description="Aktive Versionen mit Direktlinks."
      />
      {error ? <Flash tone="error">{error}</Flash> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Block title="Prompts" href="/ai/prompts" rows={data?.prompts ?? []} />
        <Block title="Regeln" href="/ai/regeln" rows={data?.rules ?? []} />
        <Block title="Szenarien" href="/ai/szenarien" rows={data?.scenarios ?? []} />
        <Block
          title="Assistenten"
          href="/ai/assistenten"
          rows={data?.assistants ?? []}
        />
      </div>
    </OpsPage>
  );
}
