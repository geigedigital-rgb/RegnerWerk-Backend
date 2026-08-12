"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  Image as ImageIcon,
  Search,
  X,
} from "lucide-react";
import type { NavSection } from "@/lib/catalog";
import { datasetLabel } from "@/lib/dataset-labels";
import type { CatalogListItem } from "@/lib/types";

export function CatalogList({
  items,
  nav,
  generatedAt,
  datasets,
  dataset,
  initialGroup,
}: {
  items: CatalogListItem[];
  nav: NavSection[];
  generatedAt: string;
  datasets: string[];
  dataset: string;
  initialGroup?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(initialGroup ?? "");
  const [onlyReview, setOnlyReview] = useState(false);
  const [onlyReady, setOnlyReady] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  const reviewCount = useMemo(
    () => items.filter((i) => i.needsReview).length,
    [items],
  );
  const readyCount = useMemo(
    () => items.filter((i) => i.calculationReady).length,
    [items],
  );

  const groupMeta = useMemo(() => {
    const m = new Map<string, { name: string; section: string }>();
    for (const s of nav) {
      for (const g of s.groups) {
        m.set(g.group_id, { name: g.name, section: s.name });
      }
    }
    return m;
  }, [nav]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((i) => {
      if (group && i.group_id !== group) return false;
      if (onlyReview && !i.needsReview) return false;
      if (onlyReady && !i.calculationReady) return false;
      if (!q) return true;
      const hay =
        `${i.title} ${i.titleDe} ${i.brand} ${i.model} ${i.article} ${i.product_id} ${i.subtype_id}`.toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [items, query, group, onlyReview, onlyReady]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  function setFilter<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setPage(0);
  }

  const dbQuery = `?db=${encodeURIComponent(dataset)}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Каталог</h1>
          <p className="mt-1 text-sm text-gray-600">
            {items.length} карточек
            {generatedAt && <> · {generatedAt}</>}
            {" · "}
            <span className="text-aqua-deep">{readyCount} ready</span>
            {" · "}
            <span className="text-gold">{reviewCount} на проверку</span>
          </p>
        </div>
        {datasets.length > 1 && (
          <div className="relative">
            <Database
              size={15}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-aqua-deep"
            />
            <select
              value={dataset}
              onChange={(e) =>
                router.push(`/produkte?db=${encodeURIComponent(e.target.value)}`)
              }
              className="max-w-[280px] appearance-none truncate rounded-full border border-gray-100 bg-white py-2 pl-9 pr-9 text-xs font-semibold outline-none transition-colors focus:border-aqua-deep"
            >
              {datasets.map((d) => (
                <option key={d} value={d}>
                  {datasetLabel(d)}
                </option>
              ))}
            </select>
            <ChevronRight
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-gray-400"
            />
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Taxonomy nav */}
        <aside className="space-y-5">
          <button
            type="button"
            onClick={() => setFilter(setGroup, "")}
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
              !group
                ? "border-aqua-deep/40 bg-mint text-forest"
                : "border-gray-100 bg-white text-gray-600 hover:border-aqua-deep/30"
            }`}
          >
            Все группы
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-gray-600">
              {items.length}
            </span>
          </button>

          {nav.map((section) => (
            <div key={section.section_id}>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {section.name}
              </p>
              <ul className="space-y-1">
                {section.groups.map((g) => {
                  if (g.count === 0) return null;
                  const active = group === g.group_id;
                  return (
                    <li key={g.group_id}>
                      <button
                        type="button"
                        onClick={() =>
                          setFilter(setGroup, active ? "" : g.group_id)
                        }
                        className={`flex w-full items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                          active
                            ? "border-aqua-deep/40 bg-mint font-semibold text-forest"
                            : "border-transparent bg-white text-gray-600 hover:border-gray-100"
                        }`}
                      >
                        <span className="min-w-0 flex-1 leading-snug">
                          {g.name}
                        </span>
                        <span className="shrink-0 rounded-full bg-ice px-2 py-0.5 text-[11px] font-bold text-gray-600">
                          {g.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        {/* Main */}
        <div>
          <div className="sticky top-14 z-30 -mx-1 space-y-3 bg-gray-50/95 px-1 py-3 backdrop-blur">
            <div className="relative">
              <Search
                size={18}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setFilter(setQuery, e.target.value)}
                placeholder="Поиск: модель, артикул, бренд, id…"
                className="w-full rounded-2xl border border-gray-100 bg-white py-2.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-aqua-deep"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !onlyReady;
                  setOnlyReady(next);
                  if (next) setOnlyReview(false);
                  setPage(0);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  onlyReady
                    ? "border-aqua-deep bg-mint text-forest"
                    : "border-gray-100 bg-white text-gray-600"
                }`}
              >
                <CheckCircle2 size={13} strokeWidth={2} />
                Calculation ready ({readyCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !onlyReview;
                  setOnlyReview(next);
                  if (next) setOnlyReady(false);
                  setPage(0);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  onlyReview
                    ? "border-gold bg-gold/15 text-forest"
                    : "border-gray-100 bg-white text-gray-600"
                }`}
              >
                <AlertTriangle size={13} strokeWidth={2} className="text-gold" />
                Needs review ({reviewCount})
              </button>
              {group && (
                <button
                  type="button"
                  onClick={() => setFilter(setGroup, "")}
                  className="flex items-center gap-1 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-xs text-gray-600"
                >
                  {groupMeta.get(group)?.name ?? group}
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-400">
            Показано {pageItems.length} из {filtered.length}
            {filtered.length !== items.length && <> (всего {items.length})</>}
            {group && groupMeta.get(group) && (
              <>
                {" · "}
                <span className="text-aqua-deep">
                  {groupMeta.get(group)!.section} → {groupMeta.get(group)!.name}
                </span>
              </>
            )}
            {pageCount > 1 && (
              <>
                {" · "}стр. {safePage + 1}/{pageCount}
              </>
            )}
          </p>

          <ul className="mt-3 space-y-2">
            {pageItems.map((item) => {
              const sub = [
                item.brand,
                item.article ? `Art. ${item.article}` : "",
                item.subtype_id,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
              <li key={item.product_id}>
                <Link
                  href={`/produkte/${encodeURIComponent(item.product_id)}${dbQuery}`}
                  className="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 transition-colors hover:border-aqua-deep/50"
                  title={item.titleDe || item.model || item.title}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-ice">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon
                        size={20}
                        strokeWidth={1.5}
                        className="text-gray-400"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug">
                        {item.title}
                      </p>
                      {item.calculationReady ? (
                        <span className="shrink-0 rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-aqua-deep">
                          ready
                        </span>
                      ) : item.needsReview ? (
                        <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-forest">
                          review
                        </span>
                      ) : null}
                    </div>
                    {sub && (
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {sub}
                      </p>
                    )}
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-gray-600">
                      <span className="max-w-[12rem] truncate rounded-full bg-ice px-2 py-0.5 font-semibold text-aqua-deep">
                        {groupMeta.get(item.group_id)?.name ?? item.group_id}
                      </span>
                      {item.missingCritical > 0 && (
                        <span className="flex items-center gap-1 font-medium text-gold">
                          <AlertTriangle size={11} strokeWidth={2} />
                          {item.missingCritical} critical
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-gray-400">
                        <ImageIcon size={11} strokeWidth={1.75} />
                        {item.imageCount}
                      </span>
                      <span className="flex items-center gap-1 text-gray-400">
                        <FileText size={11} strokeWidth={1.75} />
                        {item.docCount}
                      </span>
                    </div>
                  </div>

                  <ChevronRight
                    size={18}
                    strokeWidth={1.75}
                    className="shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-aqua-deep"
                  />
                </Link>
              </li>
              );
            })}
          </ul>

          {pageCount > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-full border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-40"
              >
                Назад
              </button>
              <span className="px-2 text-sm text-gray-400">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="rounded-full border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-40"
              >
                Дальше
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="mt-10 rounded-3xl border border-gray-100 bg-white p-12 text-center text-sm text-gray-600">
              Ничего не найдено в этой группе / по запросу.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
