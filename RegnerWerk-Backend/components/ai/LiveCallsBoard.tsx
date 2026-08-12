"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PhoneForwarded, RefreshCw, Siren } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Flash,
  OpsPage,
  PageHeader,
  Panel,
  StatStrip,
} from "@/components/ops/ui";

type Call = {
  id: string;
  from_number_e164: string | null;
  status: string;
  match_status: string;
  urgency: string;
  created_at: string;
  assistant_code: string | null;
  summary: string | null;
};

type Gateway = {
  status?: string;
  activeCalls?: number;
  version?: string;
  openaiConfigured?: boolean;
  pilotMode?: string;
};

export function LiveCallsBoard() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [gateway, setGateway] = useState<Gateway>({ status: "offline" });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [callsRes, telRes] = await Promise.all([
        fetch("/api/ai/calls?live=1", { cache: "no-store" }),
        fetch("/api/ai/telephony", { cache: "no-store" }),
      ]);
      const callsData = await callsRes.json();
      const telData = await telRes.json();
      if (!callsRes.ok) throw new Error(callsData.error || "Calls fehlgeschlagen");
      setCalls(callsData.calls ?? []);
      if (telRes.ok) setGateway(telData.gateway ?? { status: "offline" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5_000);
    return () => window.clearInterval(id);
  }, []);

  async function act(id: string, action: string) {
    setBusyId(id);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/ai/calls/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Aktion fehlgeschlagen");
      setOk(
        action === "mark_urgent"
          ? "Als dringend markiert"
          : action === "request_transfer"
            ? "Transfer / Rückruf angelegt"
            : "Callback angelegt",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusyId(null);
    }
  }

  const gatewayOk = gateway.status === "ok";

  return (
    <OpsPage>
      <PageHeader
        eyebrow="Betrieb"
        title="Live"
        description="Aktive Anrufe — Operator-Aktionen."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-forest"
          >
            <RefreshCw size={14} />
          </button>
        }
      />

      <StatStrip
        items={[
          {
            label: "Gateway",
            value: gatewayOk ? "Online" : gateway.status || "Offline",
            hint: gateway.pilotMode
              ? `Pilot: ${gateway.pilotMode}`
              : gatewayOk
                ? `v${gateway.version ?? "—"}`
                : "Prüfung",
            tone: gatewayOk ? "ok" : "warn",
            href: "/ai/telefonie",
          },
          {
            label: "GW aktiv",
            value: gateway.activeCalls ?? 0,
            hint: "Sessions",
          },
          {
            label: "DB live",
            value: calls.length,
            hint: "in_progress…",
          },
          {
            label: "Historie",
            value: "→",
            hint: "Alle Anrufe",
            href: "/ai/anrufe",
          },
        ]}
      />

      {error ? <Flash tone="error">{error}</Flash> : null}
      {ok ? <Flash tone="ok">{ok}</Flash> : null}

      <Panel title="Aktive Anrufe">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Laden…
          </p>
        ) : calls.length === 0 ? (
          <p className="text-sm text-gray-500">
            Keine aktiven Anrufe.{" "}
            <Link href="/ai/telefonie" className="text-aqua-deep hover:underline">
              Verbindung
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {calls.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-forest">
                    {c.from_number_e164 || "Unbekannt"}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {c.status} · {c.match_status}
                    {c.summary ? ` · ${c.summary}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      c.urgency === "urgent"
                        ? "bg-red-50 text-red-700"
                        : "bg-mint text-forest",
                    )}
                  >
                    {c.urgency}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    title="Dringend"
                    onClick={() => void act(c.id, "mark_urgent")}
                    className="rounded-full border border-gray-100 p-1.5 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <Siren size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    title="Transfer / Rückruf"
                    onClick={() => void act(c.id, "request_transfer")}
                    className="rounded-full border border-gray-100 p-1.5 text-forest hover:bg-gray-50 disabled:opacity-50"
                  >
                    <PhoneForwarded size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </OpsPage>
  );
}
