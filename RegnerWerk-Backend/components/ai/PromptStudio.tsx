"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  Loader2,
  Lock,
  Rocket,
  RotateCcw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Flash,
  OpsPage,
  PageHeader,
  Panel,
} from "@/components/ops/ui";

type Block = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  required: boolean;
  locked: boolean;
  draft: { id: string; content: string; version: number; status: string } | null;
  published: { id: string; content: string; version: number } | null;
};

type Release = {
  id: string;
  label: string | null;
  compiled_hash: string;
  published_at: string;
  is_active: boolean;
};

export function PromptStudio() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const active = blocks.find((b) => b.id === activeId) ?? blocks[0] ?? null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/prompts", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setBlocks(data.blocks ?? []);
      setReleases(data.releases ?? []);
      if (!activeId && data.blocks?.[0]) setActiveId(data.blocks[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!active) return;
    setDraftText(active.draft?.content ?? active.published?.content ?? "");
  }, [active?.id, active?.draft?.content, active?.published?.content]);

  async function saveDraft() {
    if (!active) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/ai/prompts/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: active.id, content: draftText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      setOk("Gespeichert");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    setOk(null);
    try {
      if (active) {
        await fetch("/api/ai/prompts/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: active.id, content: draftText }),
        });
      }
      const res = await fetch("/api/ai/prompts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeComment: "Prompt Studio" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish fehlgeschlagen");
      setOk("Published");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setPublishing(false);
    }
  }

  async function rollback(id: string) {
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/ai/prompts/releases/${id}/rollback`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rollback fehlgeschlagen");
      setOk("Rollback aktiv");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
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

  return (
    <OpsPage>
      <PageHeader
        eyebrow="Texte"
        title="Prompt Studio"
        description="Blöcke bearbeiten · speichern · publish."
        actions={
          <>
            <Link
              href="/ai/versionen"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-forest"
            >
              <History size={14} /> Historie
            </Link>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving || !active}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-forest disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Speichern
            </button>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={publishing}
              className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-2 text-sm font-semibold text-forest disabled:opacity-50"
            >
              {publishing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Rocket size={14} />
              )}
              Publish
            </button>
          </>
        }
      />

      {error ? <Flash tone="error">{error}</Flash> : null}
      {ok ? <Flash tone="ok">{ok}</Flash> : null}

      <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_220px]">
        <Panel title="Blöcke">
          <ul className="max-h-[60vh] space-y-0.5 overflow-auto">
            {blocks.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(b.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-sm",
                    active?.id === b.id
                      ? "bg-mint text-forest"
                      : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <span className="truncate">{b.name}</span>
                  {b.locked ? (
                    <Lock size={11} className="shrink-0 text-gray-400" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={active ? active.name : "Editor"}
          action={
            active ? (
              <span className="text-[10px] text-gray-400">
                {active.code}
                {active.draft ? ` · v${active.draft.version}` : ""}
              </span>
            ) : null
          }
        >
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={14}
            className="w-full rounded-xl border border-gray-100 bg-ice px-3 py-2.5 font-mono text-sm leading-relaxed text-forest"
          />
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="mt-2 text-xs text-gray-400 hover:text-forest"
          >
            {showPreview ? "Preview aus" : "Compiled preview…"}
          </button>
          {showPreview ? (
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-forest/95 p-3 text-[10px] text-mint">
              {blocks
                .map((b) => {
                  const content =
                    b.id === active?.id
                      ? draftText
                      : (b.draft?.content ?? b.published?.content ?? "");
                  return content.trim()
                    ? `## ${b.name}\n${content.trim()}`
                    : null;
                })
                .filter(Boolean)
                .join("\n\n")}
            </pre>
          ) : null}
        </Panel>

        <Panel
          title="Releases"
          action={
            <Link href="/ai/versionen" className="text-[10px] text-aqua-deep hover:underline">
              alle
            </Link>
          }
        >
          <ul className="space-y-1.5">
            {releases.length === 0 ? (
              <li className="text-sm text-gray-500">Noch leer.</li>
            ) : (
              releases.slice(0, 6).map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-gray-50 px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-forest">
                        {r.label || r.id.slice(0, 8)}
                        {r.is_active ? (
                          <span className="ml-1 text-[9px] uppercase text-aqua-deep">
                            aktiv
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(r.published_at).toLocaleString("de-DE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    {!r.is_active ? (
                      <button
                        type="button"
                        title="Rollback"
                        onClick={() => void rollback(r.id)}
                        className="rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-forest"
                      >
                        <RotateCcw size={12} />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
          <div className="mt-3 space-y-1 text-[11px]">
            <Link href="/ai/regeln" className="block text-aqua-deep hover:underline">
              → Stop-Regeln
            </Link>
            <Link href="/ai/test-lab" className="block text-aqua-deep hover:underline">
              → Test Lab
            </Link>
            <Link href="/ai/assistenten" className="block text-aqua-deep hover:underline">
              → Assistent
            </Link>
          </div>
        </Panel>
      </div>
    </OpsPage>
  );
}
