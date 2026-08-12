"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Braces,
  Check,
  Database,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { AiProduct } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

function SectionCard({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint text-aqua-deep">
          {icon}
        </span>
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-ice px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {count}
          </span>
        )}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const inputCls =
  "w-full rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-aqua-deep";

function prettyExtra(extra: Record<string, unknown>): string {
  return JSON.stringify(extra, null, 2);
}

export function ProductEditor({
  dataset,
  productKey,
  initial,
  categories,
}: {
  dataset: string;
  /** `id`, `id@n` for duplicate slugs, or `#i` */
  productKey: string;
  initial: AiProduct;
  categories: string[];
}) {
  const router = useRouter();
  const [product, setProduct] = useState<AiProduct>(initial);
  const [extraText, setExtraText] = useState(() => prettyExtra(initial.extra));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  const extraError = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(extraText);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return "Ожидается JSON-объект { … }";
      }
      return "";
    } catch (e) {
      return e instanceof Error ? e.message : "Некорректный JSON";
    }
  }, [extraText]);

  const dirty = useMemo(() => {
    if (JSON.stringify({ ...product, extra: null }) !==
        JSON.stringify({ ...initial, extra: null })) {
      return true;
    }
    return extraText !== prettyExtra(initial.extra);
  }, [product, extraText, initial]);

  function set<K extends keyof AiProduct>(key: K, value: AiProduct[K]) {
    setProduct((p) => ({ ...p, [key]: value }));
    setSaveState("idle");
  }

  const apiUrl = `/api/products/${encodeURIComponent(productKey)}?db=${encodeURIComponent(dataset)}`;
  const backHref = `/produkte?db=${encodeURIComponent(dataset)}`;

  async function save() {
    if (extraError) return;
    setSaveState("saving");
    setError("");
    try {
      const payload: AiProduct = {
        ...product,
        extra: JSON.parse(extraText) as Record<string, unknown>,
      };
      const res = await fetch(apiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      // Server trims values — sync local state so `dirty` resets cleanly.
      const saved = (await res.json()) as AiProduct;
      setProduct(saved);
      setExtraText(prettyExtra(saved.extra));
      setSaveState("saved");
      router.refresh();
    } catch (e) {
      setSaveState("error");
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Удалить продукт «${product.title}» из базы ${dataset}? Предыдущая версия останется в ${dataset}.bak.`,
      )
    )
      return;
    const res = await fetch(apiUrl, { method: "DELETE" });
    if (res.ok) {
      router.push(backHref);
      router.refresh();
    } else {
      setSaveState("error");
      setError("Не удалось удалить");
    }
  }

  const extraKeyCount = useMemo(() => {
    try {
      return Object.keys(JSON.parse(extraText) as object).length;
    } catch {
      return undefined;
    }
  }, [extraText]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-aqua-deep/50 hover:text-forest"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />К списку
        </Link>
        {product.url && (
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-aqua-deep transition-colors hover:border-aqua-deep/50"
          >
            Открыть в магазине
            <ExternalLink size={14} strokeWidth={1.75} />
          </a>
        )}
        <span className="flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 font-mono text-[11px] font-semibold text-forest">
          <Database size={12} strokeWidth={1.75} className="text-aqua-deep" />
          {dataset}
        </span>
        <span className="ml-auto hidden truncate rounded-full bg-ice px-3 py-1 font-mono text-[11px] text-gray-600 lg:block lg:max-w-md">
          {productKey}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: main fields */}
        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-100 bg-white p-5">
            <label className="block text-sm font-bold" htmlFor="title">
              Название
            </label>
            <textarea
              id="title"
              value={product.title}
              onChange={(e) => set("title", e.target.value)}
              rows={2}
              className={`${inputCls} mt-2 resize-none text-[15px] font-semibold leading-snug`}
            />

            <label
              className="mt-4 block text-sm font-bold"
              htmlFor="category"
            >
              Категория
            </label>
            <input
              id="category"
              list="category-options"
              value={product.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Hausgartenbewässerung > …"
              className={`${inputCls} mt-2`}
            />
            <datalist id="category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            <label className="mt-4 block text-sm font-bold" htmlFor="url">
              URL источника
            </label>
            <input
              id="url"
              value={product.url}
              onChange={(e) => set("url", e.target.value)}
              className={`${inputCls} mt-2 font-mono text-xs`}
            />
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-bold" htmlFor="text">
                Описание / характеристики
              </label>
              <span
                className={`text-xs ${
                  product.text.length < 100
                    ? "font-semibold text-gold"
                    : "text-gray-400"
                }`}
              >
                {product.text.length.toLocaleString("ru-RU")} символов
              </span>
            </div>
            <textarea
              id="text"
              value={product.text}
              onChange={(e) => set("text", e.target.value)}
              rows={22}
              spellCheck={false}
              className={`${inputCls} mt-2 leading-relaxed`}
            />
          </section>

          <SectionCard
            icon={<Braces size={15} strokeWidth={1.75} />}
            title="Прочие поля (JSON)"
            count={extraKeyCount}
          >
            <textarea
              value={extraText}
              onChange={(e) => {
                setExtraText(e.target.value);
                setSaveState("idle");
              }}
              rows={Math.min(18, Math.max(4, extraText.split("\n").length))}
              spellCheck={false}
              className={`${inputCls} font-mono text-xs leading-relaxed ${
                extraError ? "border-red-300 focus:border-red-400" : ""
              }`}
            />
            {extraError ? (
              <p className="mt-2 text-xs font-medium text-red-600">
                {extraError}
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-400">
                Поля этой базы, которых нет в стандартной форме. Сохраняются
                как есть.
              </p>
            )}
          </SectionCard>
        </div>

        {/* Right: media & variants */}
        <div className="space-y-6">
          <SectionCard
            icon={<ImageIcon size={15} strokeWidth={1.75} />}
            title="Картинки"
            count={product.images.length}
          >
            <ul className="space-y-3">
              {product.images.map((img, i) => (
                <li key={i} className="flex items-center gap-3">
                  <a
                    href={img}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-ice"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </a>
                  <input
                    value={img}
                    onChange={(e) =>
                      set(
                        "images",
                        product.images.map((v, j) =>
                          j === i ? e.target.value : v,
                        ),
                      )
                    }
                    className={`${inputCls} font-mono text-[11px]`}
                  />
                  <button
                    type="button"
                    aria-label="Удалить картинку"
                    onClick={() =>
                      set(
                        "images",
                        product.images.filter((_, j) => j !== i),
                      )
                    }
                    className="shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-ice hover:text-forest"
                  >
                    <X size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => set("images", [...product.images, ""])}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-semibold text-forest transition-colors hover:bg-lime/30"
            >
              <Plus size={13} strokeWidth={2} />
              Добавить URL
            </button>
          </SectionCard>

          <SectionCard
            icon={<FileText size={15} strokeWidth={1.75} />}
            title="Документы (PDF)"
            count={product.pdfs.length}
          >
            <ul className="space-y-4">
              {product.pdfs.map((pdf, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={pdf.title}
                      placeholder="Название документа"
                      onChange={(e) =>
                        set(
                          "pdfs",
                          product.pdfs.map((v, j) =>
                            j === i ? { ...v, title: e.target.value } : v,
                          ),
                        )
                      }
                      className={`${inputCls} text-xs font-semibold`}
                    />
                    <a
                      href={pdf.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Открыть PDF"
                      className="shrink-0 rounded-full p-1.5 text-aqua-deep transition-colors hover:bg-mint"
                    >
                      <ExternalLink size={15} strokeWidth={1.75} />
                    </a>
                    <button
                      type="button"
                      aria-label="Удалить документ"
                      onClick={() =>
                        set(
                          "pdfs",
                          product.pdfs.filter((_, j) => j !== i),
                        )
                      }
                      className="shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-ice hover:text-forest"
                    >
                      <X size={15} strokeWidth={2} />
                    </button>
                  </div>
                  <input
                    value={pdf.url}
                    placeholder="https://…"
                    onChange={(e) =>
                      set(
                        "pdfs",
                        product.pdfs.map((v, j) =>
                          j === i ? { ...v, url: e.target.value } : v,
                        ),
                      )
                    }
                    className={`${inputCls} mt-2 font-mono text-[11px]`}
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                set("pdfs", [...product.pdfs, { title: "", url: "" }])
              }
              className="mt-3 flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-semibold text-forest transition-colors hover:bg-lime/30"
            >
              <Plus size={13} strokeWidth={2} />
              Добавить PDF
            </button>
          </SectionCard>

          <SectionCard
            icon={<Layers size={15} strokeWidth={1.75} />}
            title="Варианты"
            count={product.variants.length}
          >
            <ul className="space-y-2">
              {product.variants.map((v, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    value={v}
                    onChange={(e) =>
                      set(
                        "variants",
                        product.variants.map((x, j) =>
                          j === i ? e.target.value : x,
                        ),
                      )
                    }
                    className={`${inputCls} text-xs`}
                  />
                  <button
                    type="button"
                    aria-label="Удалить вариант"
                    onClick={() =>
                      set(
                        "variants",
                        product.variants.filter((_, j) => j !== i),
                      )
                    }
                    className="shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-ice hover:text-forest"
                  >
                    <X size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => set("variants", [...product.variants, ""])}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-semibold text-forest transition-colors hover:bg-lime/30"
            >
              <Plus size={13} strokeWidth={2} />
              Добавить вариант
            </button>
          </SectionCard>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={remove}
            className="flex items-center gap-1.5 rounded-full border border-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-red-300 hover:text-red-600"
          >
            <Trash2 size={15} strokeWidth={1.75} />
            Удалить
          </button>

          <div className="ml-auto flex items-center gap-3">
            {saveState === "error" && (
              <span className="text-sm font-medium text-red-600">{error}</span>
            )}
            {extraError && (
              <span className="text-sm font-medium text-red-600">
                Ошибка в JSON прочих полей
              </span>
            )}
            {saveState === "saved" && !dirty && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-aqua-deep">
                <Check size={16} strokeWidth={2} />
                Сохранено
              </span>
            )}
            {dirty && saveState !== "saving" && !extraError && (
              <span className="text-sm text-gray-400">
                Есть несохранённые изменения
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saveState === "saving" || Boolean(extraError)}
              className="flex items-center gap-2 rounded-full bg-lime px-6 py-2.5 text-sm font-bold text-forest transition-colors hover:bg-lime-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveState === "saving" && (
                <Loader2 size={15} strokeWidth={2} className="animate-spin" />
              )}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
