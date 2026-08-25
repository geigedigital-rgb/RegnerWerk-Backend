"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Save, X } from "lucide-react";
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

type Connections = {
  gatewayOnline?: boolean;
  openai?: boolean;
  openaiSip?: boolean;
  telnyx?: boolean;
  telnyxPhone?: string | null;
  telnyxConnectionId?: string | null;
  webhookTelnyx?: string;
  webhookOpenAI?: string;
  texmlInbound?: string;
  routing?: string;
  secretsNote?: string;
};

function StatusDot({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-ice px-3 py-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-lime text-forest" : "bg-amber-100 text-amber-800"
        }`}
      >
        {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-forest">{label}</p>
        <p className="text-[11px] text-gray-500">{hint}</p>
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <p className="truncate font-mono text-xs text-forest">{value}</p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-ice hover:text-forest"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Kopieren"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

export function TelephonySettings() {
  const [gateway, setGateway] = useState<Record<string, unknown>>({});
  const [connections, setConnections] = useState<Connections>({});
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
      setConnections(data.connections ?? {});
      const s = data.settings ?? {};
      setPilotMode(asText(s.pilot_mode) || "after_hours");
      setTestNumber(
        asText(s.production_number_e164) ||
          asText(s.test_number_e164) ||
          asText(data.connections?.telnyxPhone) ||
          "",
      );
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
        ["production_number_e164", testNumber.trim() || null],
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

  const gwOk = connections.gatewayOnline || gateway.status === "ok";
  const ready =
    gwOk && connections.openai && connections.openaiSip && connections.telnyx;

  return (
    <OpsPage>
      <PageHeader
        eyebrow="Verbindung"
        title="Telefonie"
        description="Telnyx → Voice Gateway → OpenAI Realtime. Keys nur in Railway."
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
              : "Voice Gateway prüfen",
            tone: gwOk ? "ok" : "warn",
          },
          {
            label: "Bereit",
            value: ready ? "ja" : "nein",
            hint: ready ? "Anrufe möglich" : "Checklist unten",
            tone: ready ? "ok" : "warn",
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

      <Panel title="Verbindungen (Keys)">
        <p className="mb-3 text-[11px] text-gray-500">
          {connections.secretsNote ||
            "API-Keys stehen in Railway (Voice Gateway). Hier nur Status — nichts Geheimes in der DB."}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <StatusDot
            ok={Boolean(connections.telnyx)}
            label="Telnyx API Key"
            hint="TELNYX_API_KEY in Railway"
          />
          <StatusDot
            ok={Boolean(connections.openai)}
            label="OpenAI API + Webhook Secret"
            hint="OPENAI_API_KEY + OPENAI_WEBHOOK_SECRET"
          />
          <StatusDot
            ok={Boolean(connections.openaiSip)}
            label="OpenAI SIP URI"
            hint="OPENAI_SIP_URI (sip:…@…) — noch nötig für Audio"
          />
          <StatusDot
            ok={gwOk}
            label="Voice Gateway"
            hint="Health auf Railway / localhost:8000"
          />
        </div>
        {gateway.assistant && typeof gateway.assistant === "object" ? (
          <div className="mt-3 rounded-2xl border border-gray-100 bg-white px-3 py-3 text-xs text-gray-600">
            <p className="font-medium text-forest">Live Assistent</p>
            <p className="mt-1 font-mono text-[11px]">
              {JSON.stringify(gateway.assistant)}
            </p>
            <p className="mt-2 text-[11px] text-gray-400">
              Ändern unter{" "}
              <Link href="/ai/assistenten" className="text-aqua-deep hover:underline">
                KI → Assistenten
              </Link>{" "}
              (Publish).
            </p>
          </div>
        ) : null}
        <div className="mt-3 grid gap-2">
          <CopyRow
            label="TeXML Voice URL (Telnyx Application)"
            value={connections.texmlInbound || ""}
          />
          <CopyRow
            label="OpenAI Webhook (Dashboard)"
            value={connections.webhookOpenAI || ""}
          />
          <CopyRow
            label="Routing"
            value={connections.routing || "texml_dial_openai_sip"}
          />
          <CopyRow
            label="Telnyx Nummer"
            value={connections.telnyxPhone || testNumber || ""}
          />
          <CopyRow
            label="TeXML Application ID"
            value={connections.telnyxConnectionId || ""}
          />
        </div>
        {!connections.openaiSip ? (
          <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Fehlt noch: <strong>OPENAI_SIP_URI</strong> aus dem OpenAI Dashboard
            (Realtime SIP). Ohne sie kann TeXML den Anruf nicht zur KI dialen.
            Danach Key in Railway setzen und Gateway neu starten.
          </p>
        ) : null}
      </Panel>

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
              Telnyx-Nummer
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
          <Link href="/ai/einstellungen" className="text-aqua-deep hover:underline">
            Einstellungen
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
              {JSON.stringify({ gateway, connections }, null, 2)}
            </pre>
          </Panel>
        ) : null}
      </div>
    </OpsPage>
  );
}
