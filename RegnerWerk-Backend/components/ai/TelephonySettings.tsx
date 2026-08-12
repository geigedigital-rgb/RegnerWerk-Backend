"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import {
  Flash,
  OpsPage,
  PageHeader,
  Panel,
  StatStrip,
} from "@/components/ops/ui";

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

export function TelephonySettings() {
  const [gateway, setGateway] = useState<Record<string, unknown>>({});
  const [pilotMode, setPilotMode] = useState("after_hours");
  const [testNumber, setTestNumber] = useState("");
  const [officeTransfer, setOfficeTransfer] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [emergencyTransfer, setEmergencyTransfer] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/telephony", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setGateway(data.gateway ?? {});
      const s = data.settings ?? {};
      setPilotMode(asText(s.pilot_mode) || "after_hours");
      setTestNumber(asText(s.test_number_e164));
      setOfficeTransfer(asText(s.transfer_office_e164));
      setEmergencyTransfer(asText(s.transfer_emergency_e164));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveAll() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const entries: Array<[string, unknown]> = [
        ["pilot_mode", pilotMode],
        ["test_number_e164", testNumber.trim() || null],
        ["transfer_office_e164", officeTransfer.trim() || null],
      ];
      if (showAdvanced) {
        entries.push(["transfer_emergency_e164", emergencyTransfer.trim() || null]);
      }
      for (const [key, value] of entries) {
        const res = await fetch("/api/ai/telephony", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Fehler bei ${key}`);
      }
      setOk("Gespeichert");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <OpsPage>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Laden…
        </div>
      </OpsPage>
    );
  }

  const gwOk = gateway.status === "ok";

  return (
    <OpsPage>
      <PageHeader
        eyebrow="Verbindung"
        title="Telefonie"
        description="Nur das, was für den Alltag nötig ist."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveAll()}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
          >
            <Save size={14} /> Speichern
          </button>
        }
      />

      <StatStrip
        items={[
          {
            label: "Gateway",
            value: gwOk ? "Online" : asText(gateway.status) || "Offline",
            hint: gwOk
              ? `v${asText(gateway.version)} · ${asText(gateway.activeCalls) || 0} aktiv`
              : "localhost:8000",
            tone: gwOk ? "ok" : "warn",
          },
          {
            label: "OpenAI",
            value: gateway.openaiConfigured ? "bereit" : "offen",
            hint: "API Key / Webhook",
            tone: gateway.openaiConfigured ? "ok" : "warn",
          },
          {
            label: "Pilot",
            value: pilotMode,
            hint: "Empfangsmodus",
          },
          {
            label: "Live",
            value: "→",
            hint: "Aktive Calls",
            href: "/ai/live",
          },
        ]}
      />

      {error ? <Flash tone="error">{error}</Flash> : null}
      {ok ? <Flash tone="ok">{ok}</Flash> : null}

      <Panel title="Alltag">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-forest">
              Modus
            </span>
            <select
              value={pilotMode}
              onChange={(e) => setPilotMode(e.target.value)}
              className="w-full rounded-2xl border border-gray-100 bg-ice px-3 py-2.5 text-sm"
            >
              <option value="off">aus</option>
              <option value="after_hours">außerhalb Bürozeiten</option>
              <option value="overflow">Overflow</option>
              <option value="full">voll</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-forest">
              Testnummer
            </span>
            <input
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="+49…"
              className="w-full rounded-2xl border border-gray-100 bg-ice px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-forest">
              Transfer Büro
            </span>
            <input
              value={officeTransfer}
              onChange={(e) => setOfficeTransfer(e.target.value)}
              placeholder="+49…"
              className="w-full rounded-2xl border border-gray-100 bg-ice px-3 py-2.5 text-sm"
            />
          </label>
        </div>
        <p className="mt-3 text-[11px] text-gray-400">
          Aufnahme bleibt aus.{" "}
          <Link href="/ai/anrufe" className="text-aqua-deep hover:underline">
            Anrufe
          </Link>
          {" · "}
          <Link href="/ai" className="text-aqua-deep hover:underline">
            Übersicht
          </Link>
        </p>
      </Panel>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-gray-400 hover:text-forest"
        >
          {showAdvanced ? "Weniger" : "Erweitert…"}
        </button>
        {showAdvanced ? (
          <Panel title="Erweitert" className="mt-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-forest">
                Transfer Notfall
              </span>
              <input
                value={emergencyTransfer}
                onChange={(e) => setEmergencyTransfer(e.target.value)}
                placeholder="+49…"
                className="w-full rounded-2xl border border-gray-100 bg-ice px-3 py-2.5 text-sm"
              />
            </label>
            <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-forest/95 p-3 text-[10px] text-mint">
              {JSON.stringify(gateway, null, 2)}
            </pre>
          </Panel>
        ) : null}
      </div>
    </OpsPage>
  );
}
