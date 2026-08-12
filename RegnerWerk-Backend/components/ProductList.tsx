"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  Database,
  FileText,
  Image as ImageIcon,
  Layers,
  Search,
  X,
} from "lucide-react";
import type { ProductListItem } from "@/lib/types";
import { datasetLabel } from "@/lib/dataset-labels";

const SHORT_TEXT = 100;

function matches(item: ProductListItem, q: string): boolean {
  const hay = `${item.title} ${item.id} ${item.category}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

export function ProductList({
  items,
  generatedAt,
  datasets,
  dataset,
}: {
  items: ProductListItem[];
  generatedAt: string;
  datasets: string[];
  dataset: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (category && i.category !== category) return false;
        if (onlyProblems && i.textLength >= SHORT_TEXT && i.imageCount > 0)
          return false;
        if (query && !matches(i, query)) return false;
        return true;
      }),
    [items, query, category, onlyProblems],
  );

  const problems = useMemo(
    () =>
      items.filter((i) => i.textLength < SHORT_TEXT || i.imageCount === 0)
        .length,
    [items],
  );

  const dbQuery = `?db=${encodeURIComponent(dataset)}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Продукты</h1>
          <p className="mt-1 text-sm text-gray-600">
            {items.length} записей
            {generatedAt && <> · база от {generatedAt}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          {problems > 0 && (
            <button
              type="button"
              onClick={() => setOnlyProblems((v) => !v)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                onlyProblems
                  ? "border-gold bg-gold/15 text-forest"
                  : "border-gray-100 bg-white text-gray-600 hover:border-gold/60"
              }`}
            >
              <AlertTriangle
                size={16}
                className="text-gold"
                strokeWidth={1.75}
              />
              Проблемные: {problems}
            </button>
          )}
        </div>
      </div>

      <div className="sticky top-14 z-30 -mx-4 mt-6 bg-gray-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию, id или категории…"
              className="w-full rounded-2xl border border-gray-100 bg-white py-2.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-aqua-deep"
            />
          </div>
          <div className="relative sm:w-96">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full appearance-none truncate rounded-2xl border border-gray-100 bg-white py-2.5 pl-4 pr-10 text-sm outline-none transition-colors focus:border-aqua-deep"
            >
              <option value="">Все категории ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {category ? (
              <button
                type="button"
                onClick={() => setCategory("")}
                aria-label="Сбросить категорию"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:text-forest"
              >
                <X size={15} strokeWidth={2} />
              </button>
            ) : (
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-gray-400"
              />
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Показано {filtered.length} из {items.length}
      </p>

      <ul className="mt-2 space-y-2">
        {filtered.map((item) => {
          const short = item.textLength < SHORT_TEXT;
          return (
            <li key={item.key}>
              <Link
                href={`/produkte/${encodeURIComponent(item.key)}${dbQuery}`}
                className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-3 transition-colors hover:border-aqua-deep/50"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-ice">
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
                      size={22}
                      strokeWidth={1.5}
                      className="text-gray-400"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold leading-snug">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-aqua-deep">
                    {item.category || "— без категории —"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
                    <span className="flex items-center gap-1">
                      <ImageIcon size={12} strokeWidth={1.75} />
                      {item.imageCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText size={12} strokeWidth={1.75} />
                      {item.pdfCount}
                    </span>
                    {item.variantCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Layers size={12} strokeWidth={1.75} />
                        {item.variantCount} вар.
                      </span>
                    )}
                    <span className={short ? "font-semibold text-gold" : ""}>
                      {item.textLength.toLocaleString("ru-RU")} символов
                    </span>
                    {(short || item.imageCount === 0) && (
                      <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 font-medium text-forest">
                        <AlertTriangle
                          size={11}
                          strokeWidth={2}
                          className="text-gold"
                        />
                        {short ? "короткое описание" : "нет фото"}
                      </span>
                    )}
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

      {filtered.length === 0 && (
        <div className="mt-10 rounded-3xl border border-gray-100 bg-white p-12 text-center text-sm text-gray-600">
          Ничего не найдено. Измените запрос или сбросьте фильтры.
        </div>
      )}
    </div>
  );
}
