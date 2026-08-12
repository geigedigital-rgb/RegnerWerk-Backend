"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquareText,
  Phone,
  PhoneCall,
  Radio,
  ShieldAlert,
  TestTube2,
} from "lucide-react";
import {
  Flash,
  OpsPage,
  PageHeader,
  Panel,
  QuickLinks,
  StatStrip,
} from "@/components/ops/ui";

type Health = {
  status: "ok" | "error" | "offline";
  activeCalls?: number;
  version?: string;
};

type CallStats = { today: number; live: number };

export function AiOverviewDashboard() {
  const [health, setHealth] = useState<Health>({ status: "offline" });
  const [calls, setCalls] = useState<CallStats>({ today: 0, live: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [hRes, cRes, liveRes] = await Promise.all([
          fetch("/api/ai/health", { cache: "no-store" }),
          fetch("/api/ai/calls", { cache: "no-store" }),
          fetch("/api/ai/calls?live=1", { cache: "no-store" }),
        ]);
        const h = (await hRes.json()) as Health;
        if (!cancelled) {
          setHealth({
            status:
              hRes.ok && h.status === "ok"
                ? "ok"
                : h.status === "error"
                  ? "error"
                  : "offline",
            activeCalls: h.activeCalls ?? 0,
            version: h.version,
          });
        }
        if (cRes.ok) {
          const data = await cRes.json();
          const list = (data.calls ?? []) as Array<{ created_at: string }>;
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const today = list.filter(
            (c) => new Date(c.created_at) >= start,
          ).length;
          if (!cancelled) setCalls((prev) => ({ ...prev, today }));
        }
        if (liveRes.ok) {
          const data = await liveRes.json();
          if (!cancelled) {
            setCalls((prev) => ({
              ...prev,
              live: (data.calls ?? []).length,
            }));
          }
        }
      } catch {
        if (!cancelled) setHealth({ status: "offline" });
      }
    }
    void load();
    const id = window.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const gatewayOk = health.status === "ok";

  return (
    <OpsPage>
      <PageHeader
        eyebrow="KI"
        title="Übersicht"
        description="Verbindung, Live-Anrufe, häufige Aufgaben."
        actions={
          <Link
            href="/ai/live"
            className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-forest"
          >
            Live öffnen
          </Link>
        }
      />

      <StatStrip
        items={[
          {
            label: "Gateway",
            value: gatewayOk ? "Online" : health.status === "error" ? "Fehler" : "Offline",
            hint: gatewayOk
              ? `v${health.version ?? "?"} · GW ${health.activeCalls ?? 0}`
              : "Nicht erreichbar",
            tone: gatewayOk ? "ok" : "warn",
            href: "/ai/telefonie",
          },
          {
            label: "Live",
            value: Math.max(calls.live, health.activeCalls ?? 0),
            hint: "Aktive Gespräche",
            href: "/ai/live",
            tone: calls.live > 0 ? "ok" : "neutral",
          },
          {
            label: "Heute",
            value: calls.today,
            hint: "Anrufe seit 0:00",
            href: "/ai/anrufe",
          },
          {
            label: "Telefonie",
            value: "Setup",
            hint: "Nummer & Transfer",
            href: "/ai/telefonie",
          },
        ]}
      />

      {!gatewayOk ? (
        <Flash tone="error">
          Voice Gateway offline — Anrufe erst nach Start auf :8000.
        </Flash>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Heute arbeiten">
          <QuickLinks
            items={[
              {
                href: "/ai/live",
                label: "Live Calls",
                desc: "Aktive Gespräche",
                icon: Radio,
              },
              {
                href: "/ai/anrufe",
                label: "Anrufe",
                desc: "Historie",
                icon: PhoneCall,
              },
              {
                href: "/ai/prompts",
                label: "Prompts",
                desc: "Texte bearbeiten",
                icon: MessageSquareText,
              },
              {
                href: "/ai/regeln",
                label: "Stop-Regeln",
                desc: "Eskalation",
                icon: ShieldAlert,
              },
              {
                href: "/ai/test-lab",
                label: "Test Lab",
                desc: "Vor Publish prüfen",
                icon: TestTube2,
              },
              {
                href: "/ai/telefonie",
                label: "Verbindung",
                desc: "Gateway & Nummern",
                icon: Phone,
              },
            ]}
          />
        </Panel>

        <Panel
          title="Releases"
          action={
            <Link href="/ai/versionen" className="text-xs text-aqua-deep hover:underline">
              Alle
            </Link>
          }
        >
          <QuickLinks
            items={[
              {
                href: "/ai/assistenten",
                label: "Assistent Empfang",
                desc: "Bundle publish",
              },
              {
                href: "/ai/wissen",
                label: "Wissen",
                desc: "Artikel",
              },
              {
                href: "/ai/szenarien",
                label: "Szenarien",
                desc: "Gesprächsablauf",
              },
              {
                href: "/ai/versionen",
                label: "Versionshistorie",
                desc: "Prompt · Rules · Assistent",
              },
            ]}
          />
        </Panel>
      </div>
    </OpsPage>
  );
}
