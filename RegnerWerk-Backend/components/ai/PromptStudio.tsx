"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FilePlus2,
  History,
  Loader2,
  Lock,
  Rocket,
  RotateCcw,
  Save,
  Star,
  FileDown,
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
  compiled_content?: string;
  change_comment: string | null;
  published_at: string;
  is_active: boolean;
  avg_rating: number | null;
  review_count: number;
};

type Review = {
  id: string;
  rating: number | null;
  comment: string;
  created_at: string;
  author_name?: string | null;
  author_email?: string | null;
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

  const [publishLabel, setPublishLabel] = useState("");
  const [publishComment, setPublishComment] = useState("");

  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [releaseDetail, setReleaseDetail] = useState<{
    release: Release;
    reviews: Review[];
  } | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const [newBlockOpen, setNewBlockOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

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

  async function loadRelease(id: string) {
    setSelectedReleaseId(id);
    try {
      const res = await fetch(`/api/ai/prompts/releases/${id}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Release laden fehlgeschlagen");
      setReleaseDetail(data);
      setReviewRating(0);
      setReviewComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
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
      setOk("Entwurf gespeichert");
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
        body: JSON.stringify({
          label: publishLabel.trim() || undefined,
          changeComment:
            publishComment.trim() || "Prompt Studio Veröffentlichung",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish fehlgeschlagen");
      setOk("Published — Live aktiv");
      setPublishLabel("");
      setPublishComment("");
      await load();
      if (data.release?.id) void loadRelease(data.release.id);
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
      setOk("Rollback live — Entwurf ebenfalls geladen");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function restoreToDraft(id: string) {
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/ai/prompts/releases/${id}/restore`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setOk(`${data.restored ?? 0} Blöcke als Entwurf geladen (Live unverändert)`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function submitReview() {
    if (!selectedReleaseId) return;
    setReviewSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ai/prompts/releases/${selectedReleaseId}/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating: reviewRating || null,
            comment: reviewComment,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Feedback fehlgeschlagen");
      setOk("Feedback gespeichert");
      await loadRelease(selectedReleaseId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setReviewSaving(false);
    }
  }

  async function createBlock() {
    setError(null);
    try {
      const res = await fetch("/api/ai/prompts/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode,
          name: newName,
          content: `# ${newName}\n\n`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Anlegen fehlgeschlagen");
      setNewBlockOpen(false);
      setNewCode("");
      setNewName("");
      setOk("Neuer Block angelegt");
      await load();
      if (data.document?.id) setActiveId(data.document.id);
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
        description="Blöcke bearbeiten · veröffentlichen · bewerten · zurücksetzen."
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
              onClick={() => setNewBlockOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-forest"
            >
              <FilePlus2 size={14} /> Neu
            </button>
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

      {newBlockOpen ? (
        <Panel title="Neuer Prompt-Block">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-gray-500">Code</span>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="conversation_flow"
                className="mt-1 w-full rounded-xl border border-gray-100 bg-ice px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="text-gray-500">Name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Gesprächsführung"
                className="mt-1 w-full rounded-xl border border-gray-100 bg-ice px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void createBlock()}
            className="mt-3 rounded-full bg-forest px-3 py-2 text-sm text-white"
          >
            Anlegen
          </button>
        </Panel>
      ) : null}

      <Panel title="Publish-Notiz">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="text-gray-500">Label (optional)</span>
            <input
              value={publishLabel}
              onChange={(e) => setPublishLabel(e.target.value)}
              placeholder="Empfang v3 — beratend kurz"
              className="mt-1 w-full rounded-xl border border-gray-100 bg-ice px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-gray-500">Änderung / Kommentar</span>
            <input
              value={publishComment}
              onChange={(e) => setPublishComment(e.target.value)}
              placeholder="Was hat sich geändert?"
              className="mt-1 w-full rounded-xl border border-gray-100 bg-ice px-3 py-2 text-sm"
            />
          </label>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
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
                {active.draft ? ` · draft v${active.draft.version}` : ""}
              </span>
            ) : null
          }
        >
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={16}
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

        <Panel title="Veröffentlichungen">
          <ul className="max-h-[40vh] space-y-1.5 overflow-auto">
            {releases.length === 0 ? (
              <li className="text-sm text-gray-500">Noch leer.</li>
            ) : (
              releases.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => void loadRelease(r.id)}
                    className={cn(
                      "w-full rounded-xl border px-2.5 py-2 text-left",
                      selectedReleaseId === r.id
                        ? "border-aqua-deep/40 bg-mint/40"
                        : "border-gray-50 hover:bg-gray-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-forest">
                          {r.label || r.id.slice(0, 8)}
                          {r.is_active ? (
                            <span className="ml-1 text-[9px] uppercase text-aqua-deep">
                              live
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(r.published_at).toLocaleString("de-DE", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                          {r.avg_rating != null
                            ? ` · ★ ${r.avg_rating}`
                            : ""}
                          {r.review_count
                            ? ` · ${r.review_count} Feedback`
                            : ""}
                        </p>
                      </div>
                    </div>
                    {r.change_comment ? (
                      <p className="mt-1 line-clamp-2 text-[10px] text-gray-500">
                        {r.change_comment}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>

      {releaseDetail ? (
        <Panel
          title={`Release · ${releaseDetail.release.label || releaseDetail.release.id.slice(0, 8)}`}
          action={
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void restoreToDraft(releaseDetail.release.id)}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-forest"
              >
                <FileDown size={12} /> Als Entwurf
              </button>
              {!releaseDetail.release.is_active ? (
                <button
                  type="button"
                  onClick={() => void rollback(releaseDetail.release.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-forest"
                >
                  <RotateCcw size={12} /> Live setzen
                </button>
              ) : (
                <span className="rounded-full bg-mint px-2 py-1 text-[10px] uppercase text-aqua-deep">
                  aktiv
                </span>
              )}
            </div>
          }
        >
          {releaseDetail.release.change_comment ? (
            <p className="mb-2 text-sm text-gray-600">
              {releaseDetail.release.change_comment}
            </p>
          ) : null}
          <pre className="mb-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-forest/95 p-3 text-[10px] text-mint">
            {releaseDetail.release.compiled_content || "(kein Inhalt)"}
          </pre>

          <div className="mb-3 rounded-xl border border-gray-100 bg-ice p-3">
            <p className="mb-2 text-xs font-medium text-forest">
              Bewertung & Kommentar
            </p>
            <div className="mb-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewRating(n)}
                  className="rounded p-0.5"
                  title={`${n} Sterne`}
                >
                  <Star
                    size={18}
                    className={
                      n <= reviewRating
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300"
                    }
                  />
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={2}
              placeholder="Was war gut / schlecht am Gespräch?"
              className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={reviewSaving || (!reviewRating && !reviewComment.trim())}
              onClick={() => void submitReview()}
              className="mt-2 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {reviewSaving ? "…" : "Feedback speichern"}
            </button>
          </div>

          <ul className="space-y-2">
            {releaseDetail.reviews.length === 0 ? (
              <li className="text-sm text-gray-500">Noch kein Feedback.</li>
            ) : (
              releaseDetail.reviews.map((rv) => (
                <li
                  key={rv.id}
                  className="rounded-xl border border-gray-50 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    {rv.rating != null ? (
                      <span className="text-amber-600">★ {rv.rating}</span>
                    ) : null}
                    <span>
                      {rv.author_name || rv.author_email || "Team"}
                    </span>
                    <span>
                      {new Date(rv.created_at).toLocaleString("de-DE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  {rv.comment ? (
                    <p className="mt-1 text-forest">{rv.comment}</p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </Panel>
      ) : null}
    </OpsPage>
  );
}
