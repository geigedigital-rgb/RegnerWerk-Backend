"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Rocket, Save } from "lucide-react";
import { cn } from "@/lib/cn";

type Category = { id: string; code: string; name_de: string };
type Article = {
  id: string;
  category_id: string;
  title: string;
  content: string;
  status: string;
  sensitivity: string;
  version: number;
  category?: Category | null;
};

export function KnowledgeStudio() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sensitivity, setSensitivity] = useState("normal");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const active = articles.find((a) => a.id === activeId) ?? null;

  const filtered = useMemo(
    () =>
      filterCat
        ? articles.filter((a) => a.category_id === filterCat)
        : articles,
    [articles, filterCat],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/knowledge", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setCategories(data.categories ?? []);
      setArticles(data.articles ?? []);
      if (!categoryId && data.categories?.[0]) {
        setCategoryId(data.categories[0].id);
      }
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
    setTitle(active.title);
    setContent(active.content);
    setCategoryId(active.category_id);
    setSensitivity(active.sensitivity);
  }, [active?.id]);

  function newArticle() {
    setActiveId(null);
    setTitle("");
    setContent("");
    setSensitivity("normal");
    setCategoryId(categories[0]?.id ?? "");
  }

  async function save() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/ai/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeId ?? undefined,
          category_id: categoryId,
          title,
          content,
          sensitivity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      setOk("Gespeichert (draft)");
      setActiveId(data.article.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const saveRes = await fetch("/api/ai/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeId ?? undefined,
          category_id: categoryId,
          title,
          content,
          sensitivity,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Speichern fehlgeschlagen");
      const id = saveData.article.id as string;
      setActiveId(id);
      const res = await fetch(`/api/ai/knowledge/${id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish fehlgeschlagen");
      setOk("Veröffentlicht");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-12 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Wissensbasis laden…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-aqua-deep">
            KI-Assistent · §14
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-forest">
            Wissensbasis
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600">
            Genehmigte Artikel für Assistenten — nur published Inhalte gehen live.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={newArticle}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-forest"
          >
            <Plus size={14} /> Neu
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-forest disabled:opacity-50"
          >
            <Save size={14} /> Speichern
          </button>
          <button
            type="button"
            disabled={busy || !activeId}
            onClick={() => void publish()}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
          >
            <Rocket size={14} /> Publish
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-gray-100 bg-white p-3">
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="mb-2 w-full rounded-2xl border border-gray-100 bg-ice px-3 py-2 text-sm"
          >
            <option value="">Alle Kategorien</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_de}
              </option>
            ))}
          </select>
          <ul className="max-h-[70vh] space-y-0.5 overflow-auto">
            {filtered.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(a.id)}
                  className={cn(
                    "w-full rounded-2xl px-3 py-2 text-left",
                    activeId === a.id ? "bg-mint" : "hover:bg-gray-50",
                  )}
                >
                  <p className="truncate text-sm font-medium text-forest">
                    {a.title}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {a.category?.name_de ?? "—"} · {a.status} · v{a.version}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rounded-3xl border border-gray-100 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-forest">Titel</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-forest">
                Kategorie
              </span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_de}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-forest">
                Sensitivität
              </span>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm"
              >
                <option value="normal">normal</option>
                <option value="price">price</option>
                <option value="legal">legal</option>
                <option value="internal">internal</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-forest">Inhalt</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm leading-relaxed"
            />
          </label>
        </section>
      </div>
    </div>
  );
}
