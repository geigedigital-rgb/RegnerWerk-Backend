"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  Inbox,
  ListTodo,
  Users,
  Wrench,
} from "lucide-react";
import type { CrmOverviewStats } from "@/lib/crm/types";
import {
  Flash,
  OpsPage,
  PageHeader,
  Panel,
  QuickLinks,
  StatStrip,
} from "@/components/ops/ui";

export function CrmOverviewDashboard() {
  const [stats, setStats] = useState<CrmOverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/crm/overview", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
        if (!cancelled) setStats(data.stats);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Fehler");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const attention =
    (stats?.inboxOpen ?? 0) +
    (stats?.tasksOverdue ?? 0) +
    (stats?.urgentServiceCases ?? 0) +
    (stats?.leadsWithoutNextAction ?? 0);

  return (
    <OpsPage>
      <PageHeader
        eyebrow="CRM"
        title="Übersicht"
        description="Was heute dran ist."
        actions={
          <Link
            href="/crm/inbox"
            className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-forest"
          >
            Inbox
          </Link>
        }
      />

      {error ? (
        <Flash tone="error">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </span>
        </Flash>
      ) : null}

      <StatStrip
        items={[
          {
            label: "Inbox",
            value: stats?.inboxOpen ?? 0,
            hint: "offen",
            href: "/crm/inbox",
            tone: (stats?.inboxOpen ?? 0) > 0 ? "warn" : "neutral",
          },
          {
            label: "Leads",
            value: stats?.leadsNew ?? 0,
            hint: "aktiv",
            href: "/crm/leads",
          },
          {
            label: "Überfällig",
            value: stats?.tasksOverdue ?? 0,
            hint: "Aufgaben",
            href: "/crm/aufgaben",
            tone: (stats?.tasksOverdue ?? 0) > 0 ? "warn" : "neutral",
          },
          {
            label: "Service!",
            value: stats?.urgentServiceCases ?? 0,
            hint: "dringend",
            href: "/crm/service",
            tone: (stats?.urgentServiceCases ?? 0) > 0 ? "bad" : "neutral",
          },
        ]}
      />

      {attention > 0 ? (
        <p className="text-xs text-amber-700">
          {attention} Punkte brauchen Aufmerksamkeit.
        </p>
      ) : (
        <p className="text-xs text-gray-400">Alles ruhig — gute Basis.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Kundenarbeit">
          <QuickLinks
            items={[
              {
                href: "/crm/inbox",
                label: "Inbox",
                desc: "Neue Anfragen",
                icon: Inbox,
              },
              {
                href: "/crm/leads",
                label: "Leads",
                desc: "Qualifikation",
                icon: ClipboardList,
              },
              {
                href: "/crm/kunden",
                label: "Kunden",
                desc: "Kontakte & Timeline",
                icon: Users,
              },
              {
                href: "/crm/aufgaben",
                label: "Aufgaben",
                desc: "Heute / überfällig",
                icon: ListTodo,
              },
            ]}
          />
        </Panel>
        <Panel title="Verkauf & Bau">
          <QuickLinks
            items={[
              {
                href: "/crm/pipeline",
                label: "Pipeline",
                desc: `${stats?.openOpportunities ?? 0} offen`,
                icon: ClipboardList,
              },
              {
                href: "/crm/montageprojekte",
                label: "Montage",
                desc: `${stats?.activeMontageProjects ?? 0} aktiv`,
                icon: ListTodo,
              },
              {
                href: "/crm/service",
                label: "Service",
                desc: `${stats?.openServiceCases ?? 0} offen`,
                icon: Wrench,
              },
            ]}
          />
          {(stats?.leadsWithoutNextAction ?? 0) > 0 ||
          (stats?.offersWaitingFollowUp ?? 0) > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-amber-800">
              {(stats?.leadsWithoutNextAction ?? 0) > 0 ? (
                <li>
                  <Link href="/crm/leads" className="hover:underline">
                    {stats?.leadsWithoutNextAction} Leads ohne nächste Aktion
                  </Link>
                </li>
              ) : null}
              {(stats?.offersWaitingFollowUp ?? 0) > 0 ? (
                <li>
                  <Link href="/crm/pipeline" className="hover:underline">
                    {stats?.offersWaitingFollowUp} Angebote warten auf Follow-up
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}
        </Panel>
      </div>
    </OpsPage>
  );
}
