"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { attrLabel, loc } from "@/lib/catalog";
import { datasetLabel } from "@/lib/dataset-labels";
import type {
  AttributeDef,
  CatalogProduct,
  GroupSchema,
  TaxonomyGroup,
  TaxonomySection,
} from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

const inputCls =
  "w-full rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-aqua-deep";

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold">{title}</h2>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function statusColor(status: string | undefined): string {
  switch (status) {
    case "confirmed":
      return "bg-mint text-aqua-deep";
    case "inferred":
      return "bg-ice text-gray-600";
    case "not_found":
      return "bg-gold/15 text-forest";
    case "needs_review":
      return "bg-gold/20 text-forest";
    default:
      return "bg-gray-50 text-gray-400";
  }
}

function AttrField({
  def,
  value,
  status,
  onChange,
  onStatus,
}: {
  def: AttributeDef;
  value: unknown;
  status?: string;
  onChange: (v: unknown) => void;
  onStatus: (s: string) => void;
}) {
  const critical = def.critical_for_calculation;
  const empty = value === null || value === undefined || value === "";

  return (
    <div
      className={`rounded-2xl border p-3 ${
        critical && empty
          ? "border-gold/50 bg-gold/5"
          : "border-gray-100 bg-gray-50/50"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-forest">
          {attrLabel(def)}
          {def.unit ? (
            <span className="ml-1 font-normal text-gray-400">({def.unit})</span>
          ) : null}
        </label>
        {critical && (
          <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-forest">
            critical
          </span>
        )}
        <select
          value={status || "not_found"}
          onChange={(e) => onStatus(e.target.value)}
          className={`ml-auto rounded-full border-0 px-2 py-0.5 text-[10px] font-bold outline-none ${statusColor(status)}`}
        >
          <option value="confirmed">confirmed</option>
          <option value="inferred">inferred</option>
          <option value="not_found">not_found</option>
          <option value="needs_review">needs_review</option>
        </select>
      </div>

      {def.data_type === "boolean" ? (
        <select
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : v === "true");
          }}
          className={inputCls}
        >
          <option value="">—</option>
          <option value="true">да</option>
          <option value="false">нет</option>
        </select>
      ) : def.data_type === "enum" && def.allowed_values ? (
        <select
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : e.target.value)
          }
          className={inputCls}
        >
          <option value="">—</option>
          {def.allowed_values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : def.data_type === "number" || def.data_type === "integer" ? (
        <input
          type="number"
          step={def.data_type === "integer" ? 1 : "any"}
          value={value == null ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") onChange(null);
            else
              onChange(
                def.data_type === "integer"
                  ? Number.parseInt(raw, 10)
                  : Number.parseFloat(raw),
              );
          }}
          className={inputCls}
        />
      ) : (
        <input
          type="text"
          value={value == null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : e.target.value)
          }
          className={inputCls}
        />
      )}
    </div>
  );
}

export function CatalogEditor({
  dataset,
  initial,
  schema,
  sections,
  groups,
}: {
  dataset: string;
  initial: CatalogProduct;
  schema: GroupSchema | null;
  sections: TaxonomySection[];
  groups: TaxonomyGroup[];
}) {
  const router = useRouter();
  const [product, setProduct] = useState<CatalogProduct>(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  const dirty = useMemo(
    () => JSON.stringify(product) !== JSON.stringify(initial),
    [product, initial],
  );

  const groupOptions = useMemo(() => {
    return groups.map((g) => ({
      id: g.group_id,
      label: `${loc(sections.find((s) => s.section_id === g.section_id)?.name)} · ${loc(g.name)}`,
      subtypes: g.subtypes?.map((s) => s.subtype_id) ?? [],
    }));
  }, [groups, sections]);

  const currentGroup = groupOptions.find((g) => g.id === product.group_id);
  const attrDefs = schema?.attributes ?? [];

  function patch(partial: Partial<CatalogProduct>) {
    setProduct((p) => ({ ...p, ...partial }));
    setSaveState("idle");
  }

  function setAttr(id: string, value: unknown) {
    setProduct((p) => ({
      ...p,
      attributes: { ...p.attributes, [id]: value },
    }));
    setSaveState("idle");
  }

  function setFieldStatus(path: string, status: string) {
    setProduct((p) => ({
      ...p,
      field_status: { ...(p.field_status ?? {}), [path]: status },
    }));
    setSaveState("idle");
  }

  function setName(lang: "ru" | "de", value: string) {
    const name =
      typeof product.name === "object" && product.name !== null
        ? { ...product.name }
        : { de: String(product.name || ""), ru: "" };
    name[lang] = value;
    patch({ name });
  }

  const nameRu =
    typeof product.name === "object" ? product.name?.ru || "" : "";
  const nameDe =
    typeof product.name === "object"
      ? product.name?.de || ""
      : String(product.name || "");

  const apiUrl = `/api/products/${encodeURIComponent(product.product_id)}?db=${encodeURIComponent(dataset)}`;
  const backHref = `/produkte?db=${encodeURIComponent(dataset)}`;

  async function save() {
    setSaveState("saving");
    setError("");
    try {
      const res = await fetch(apiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setProduct((await res.json()) as CatalogProduct);
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
        `Удалить «${nameRu || nameDe}» из ${dataset}? Останется бэкап .bak.`,
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

  const images = product.media?.images ?? [];
  const docs = product.media?.documents ?? [];
  const q = product.quality;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-aqua-deep/50 hover:text-forest"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />К списку
        </Link>
        {product.source?.source_url && (
          <a
            href={product.source.source_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-aqua-deep transition-colors hover:border-aqua-deep/50"
          >
            Источник
            <ExternalLink size={14} strokeWidth={1.75} />
          </a>
        )}
        <span className="flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-[11px] font-semibold text-forest">
          <Database size={12} strokeWidth={1.75} className="text-aqua-deep" />
          {datasetLabel(dataset)}
        </span>
        <span className="ml-auto hidden truncate rounded-full bg-ice px-3 py-1 font-mono text-[11px] text-gray-600 lg:block lg:max-w-sm">
          {product.product_id}
        </span>
      </div>

      {/* Quality strip */}
      <div className="mt-5 flex flex-wrap gap-2">
        {q?.calculation_ready ? (
          <span className="flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-xs font-bold text-aqua-deep">
            <CheckCircle2 size={14} strokeWidth={2} />
            calculation ready
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 text-xs font-bold text-forest">
            <AlertTriangle size={14} strokeWidth={2} className="text-gold" />
            needs review
          </span>
        )}
        {(q?.warnings ?? []).map((w) => (
          <span
            key={w}
            className="rounded-full border border-gray-100 bg-white px-3 py-1.5 text-[11px] text-gray-600"
          >
            {w}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SectionCard title="Идентичность">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold">Название (RU)</label>
                <input
                  value={nameRu}
                  onChange={(e) => setName("ru", e.target.value)}
                  className={`${inputCls} mt-1.5 font-semibold`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold">Название (DE)</label>
                <input
                  value={nameDe}
                  onChange={(e) => setName("de", e.target.value)}
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="text-xs font-bold">Бренд</label>
                <input
                  value={product.brand ?? ""}
                  onChange={(e) => patch({ brand: e.target.value })}
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="text-xs font-bold">Производитель</label>
                <input
                  value={product.manufacturer ?? ""}
                  onChange={(e) => patch({ manufacturer: e.target.value })}
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="text-xs font-bold">Серия</label>
                <input
                  value={product.series ?? ""}
                  onChange={(e) => patch({ series: e.target.value })}
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="text-xs font-bold">Модель</label>
                <input
                  value={product.model ?? ""}
                  onChange={(e) => patch({ model: e.target.value })}
                  className={`${inputCls} mt-1.5`}
                />
              </div>
              <div>
                <label className="text-xs font-bold">Артикул</label>
                <input
                  value={product.article ?? ""}
                  onChange={(e) => patch({ article: e.target.value })}
                  className={`${inputCls} mt-1.5 font-mono`}
                />
              </div>
              <div>
                <label className="text-xs font-bold">Статус</label>
                <select
                  value={product.lifecycle_status ?? "active"}
                  onChange={(e) => patch({ lifecycle_status: e.target.value })}
                  className={`${inputCls} mt-1.5`}
                >
                  <option value="active">active</option>
                  <option value="discontinued">discontinued</option>
                  <option value="draft">draft</option>
                </select>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Классификация" hint="section → group → subtype">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold">Группа</label>
                <select
                  value={product.group_id}
                  onChange={(e) =>
                    patch({
                      group_id: e.target.value,
                      subtype_id: "",
                    })
                  }
                  className={`${inputCls} mt-1.5`}
                >
                  {groupOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold">Subtype</label>
                <select
                  value={product.subtype_id ?? ""}
                  onChange={(e) =>
                    patch({ subtype_id: e.target.value || null })
                  }
                  className={`${inputCls} mt-1.5 font-mono text-xs`}
                >
                  <option value="">—</option>
                  {(currentGroup?.subtypes ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold">Единица</label>
                <input
                  value={product.unit ?? ""}
                  onChange={(e) => patch({ unit: e.target.value })}
                  className={`${inputCls} mt-1.5`}
                />
              </div>
            </div>
            {!schema && (
              <p className="mt-3 text-xs text-gold">
                Для этой группы нет schema в group_schemas.json — атрибуты
                ниже недоступны по шаблону.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Характеристики"
            hint={
              schema
                ? `${attrDefs.length} полей · ${loc(schema.name)}`
                : undefined
            }
          >
            {attrDefs.length === 0 ? (
              <p className="text-sm text-gray-400">Нет шаблона атрибутов.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {attrDefs.map((def) => (
                  <AttrField
                    key={def.attribute_id}
                    def={def}
                    value={product.attributes?.[def.attribute_id]}
                    status={
                      product.field_status?.[
                        `attributes.${def.attribute_id}`
                      ]
                    }
                    onChange={(v) => setAttr(def.attribute_id, v)}
                    onStatus={(s) =>
                      setFieldStatus(`attributes.${def.attribute_id}`, s)
                    }
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {(product.connections?.length ?? 0) > 0 && (
            <SectionCard
              title="Подключения"
              hint={`${product.connections.length}`}
            >
              <ul className="space-y-2">
                {product.connections.map((c, i) => (
                  <li
                    key={i}
                    className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 font-mono text-xs text-gray-600"
                  >
                    <span className="font-bold text-forest">
                      {c.port_id || c.role || `port-${i}`}
                    </span>
                    {" · "}
                    {c.connection_type}
                    {c.thread_size_inch && ` · ${c.thread_size_inch}`}
                    {c.thread_gender && ` ${c.thread_gender}`}
                    {c.nominal_size_mm != null && ` · ⌀${c.nominal_size_mm} mm`}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <SectionCard title="Качество">
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(product.quality?.calculation_ready)}
                  onChange={(e) =>
                    patch({
                      quality: {
                        ...(product.quality ?? {}),
                        calculation_ready: e.target.checked,
                      },
                    })
                  }
                />
                <span className="font-semibold">calculation_ready</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(product.quality?.needs_review)}
                  onChange={(e) =>
                    patch({
                      quality: {
                        ...(product.quality ?? {}),
                        needs_review: e.target.checked,
                      },
                    })
                  }
                />
                <span className="font-semibold">needs_review</span>
              </label>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-gray-400">
                    classif.
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={product.quality?.classification_confidence ?? ""}
                    onChange={(e) =>
                      patch({
                        quality: {
                          ...(product.quality ?? {}),
                          classification_confidence:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        },
                      })
                    }
                    className={`${inputCls} mt-1`}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-400">
                    extract.
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={product.quality?.extraction_confidence ?? ""}
                    onChange={(e) =>
                      patch({
                        quality: {
                          ...(product.quality ?? {}),
                          extraction_confidence:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        },
                      })
                    }
                    className={`${inputCls} mt-1`}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Картинки" hint={`${images.length}`}>
            <ul className="space-y-3">
              {images.map((img, i) => (
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
                    onChange={(e) => {
                      const next = [...images];
                      next[i] = e.target.value;
                      patch({
                        media: { ...(product.media ?? {}), images: next },
                      });
                    }}
                    className={`${inputCls} font-mono text-[11px]`}
                  />
                  <button
                    type="button"
                    aria-label="Удалить"
                    onClick={() =>
                      patch({
                        media: {
                          ...(product.media ?? {}),
                          images: images.filter((_, j) => j !== i),
                        },
                      })
                    }
                    className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-ice hover:text-forest"
                  >
                    <X size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                patch({
                  media: {
                    ...(product.media ?? {}),
                    images: [...images, ""],
                  },
                })
              }
              className="mt-3 flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-semibold text-forest hover:bg-lime/30"
            >
              <Plus size={13} strokeWidth={2} />
              URL
            </button>
          </SectionCard>

          <SectionCard title="Документы" hint={`${docs.length}`}>
            <ul className="space-y-3">
              {docs.map((doc, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <FileText
                      size={14}
                      strokeWidth={1.75}
                      className="shrink-0 text-aqua-deep"
                    />
                    <input
                      value={doc.title}
                      onChange={(e) => {
                        const next = docs.map((d, j) =>
                          j === i ? { ...d, title: e.target.value } : d,
                        );
                        patch({
                          media: {
                            ...(product.media ?? {}),
                            documents: next,
                          },
                        });
                      }}
                      className={`${inputCls} text-xs font-semibold`}
                    />
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full p-1.5 text-aqua-deep hover:bg-mint"
                    >
                      <ExternalLink size={14} strokeWidth={1.75} />
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          media: {
                            ...(product.media ?? {}),
                            documents: docs.filter((_, j) => j !== i),
                          },
                        })
                      }
                      className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-ice"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                  <input
                    value={doc.url}
                    onChange={(e) => {
                      const next = docs.map((d, j) =>
                        j === i ? { ...d, url: e.target.value } : d,
                      );
                      patch({
                        media: { ...(product.media ?? {}), documents: next },
                      });
                    }}
                    className={`${inputCls} mt-2 font-mono text-[11px]`}
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                patch({
                  media: {
                    ...(product.media ?? {}),
                    documents: [...docs, { title: "", url: "" }],
                  },
                })
              }
              className="mt-3 flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-semibold text-forest hover:bg-lime/30"
            >
              <Plus size={13} strokeWidth={2} />
              PDF
            </button>
          </SectionCard>

          {product.source && (
            <SectionCard title="Источник (readonly)">
              <dl className="space-y-2 text-xs text-gray-600">
                <div>
                  <dt className="font-bold text-gray-400">category</dt>
                  <dd>{product.source.source_category || "—"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-gray-400">title</dt>
                  <dd className="leading-snug">
                    {product.source.source_title || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-gray-400">record id</dt>
                  <dd className="break-all font-mono text-[10px]">
                    {product.source.source_record_id || "—"}
                  </dd>
                </div>
              </dl>
            </SectionCard>
          )}
        </div>
      </div>

      {/* Sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={remove}
            className="flex items-center gap-1.5 rounded-full border border-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:border-red-300 hover:text-red-600"
          >
            <Trash2 size={15} strokeWidth={1.75} />
            Удалить
          </button>
          <div className="ml-auto flex items-center gap-3">
            {saveState === "error" && (
              <span className="text-sm font-medium text-red-600">{error}</span>
            )}
            {saveState === "saved" && !dirty && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-aqua-deep">
                <Check size={16} strokeWidth={2} />
                Сохранено
              </span>
            )}
            {dirty && saveState !== "saving" && (
              <span className="text-sm text-gray-400">
                Есть несохранённые изменения
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saveState === "saving"}
              className="flex items-center gap-2 rounded-full bg-lime px-6 py-2.5 text-sm font-bold text-forest hover:bg-lime-hover disabled:cursor-not-allowed disabled:opacity-40"
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
