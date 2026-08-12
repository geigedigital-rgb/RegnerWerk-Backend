"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Layers,
  Link2,
  Table2,
} from "lucide-react";
import {
  assortmentDisplayName,
  formatPriceEur,
  parseCompatibility,
  roleLabel,
  type AssortmentPeer,
} from "@/lib/assortment";
import { attrLabel, loc } from "@/lib/catalog";
import { datasetLabel } from "@/lib/dataset-labels";
import type {
  AttributeDef,
  CatalogProduct,
  GroupSchema,
} from "@/lib/types";
import { CompatibilityPanel } from "@/components/CompatibilityPanel";
import { VariantOptionsPanel } from "@/components/VariantOptionsPanel";
import type { VariantRow } from "@/components/VariantOptionsPanel";

type TabId = "design" | "compat" | "tables" | "attrs" | "ports" | "meta";

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "да" : "нет";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== "object")) return v.join(", ");
    return JSON.stringify(v);
  }
  return JSON.stringify(v);
}

function statusPill(ok: boolean | undefined, yes: string, no: string) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-semibold text-aqua-deep">
      <CheckCircle2 size={11} />
      {yes}
    </span>
  ) : (
    <span className="rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-gray-400">
      {no}
    </span>
  );
}

function Section({
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

function Kv({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div
        className={`mt-0.5 break-words text-sm text-forest ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function NestedObject({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) {
    return <span className="text-gray-400">—</span>;
  }
  if (typeof data !== "object") {
    return <span>{fmt(data)}</span>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400">[]</span>;
    if (data.every((x) => typeof x !== "object" || x === null)) {
      return <span>{data.map(fmt).join(", ")}</span>;
    }
    return (
      <div className="space-y-2">
        {data.map((item, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-100 bg-gray-50/60 p-2.5"
          >
            <div className="mb-1 text-[10px] font-semibold text-gray-400">
              #{i + 1}
            </div>
            <NestedObject data={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="text-gray-400">{"{}"}</span>;
  }
  return (
    <dl
      className={`grid gap-x-4 gap-y-2 ${
        depth === 0 ? "sm:grid-cols-2" : "grid-cols-1"
      }`}
    >
      {entries.map(([k, v]) => (
        <div key={k} className={typeof v === "object" && v !== null ? "sm:col-span-2" : ""}>
          <dt className="text-[10px] font-medium text-gray-400">{k}</dt>
          <dd className="mt-0.5 text-sm">
            {typeof v === "object" && v !== null ? (
              <div className="mt-1 rounded-xl border border-gray-100 bg-ice/60 p-2.5">
                <NestedObject data={v} depth={depth + 1} />
              </div>
            ) : (
              <span className="break-words">{fmt(v)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PerfTable({ table }: { table: Record<string, unknown> }) {
  const columns = Array.isArray(table.columns)
    ? (table.columns as string[])
    : [];
  const rows = Array.isArray(table.rows)
    ? (table.rows as Record<string, unknown>[])
    : [];
  const units = asObj(table.units);
  const notes = Array.isArray(table.notes) ? (table.notes as string[]) : [];
  const provenance = asObj(table.provenance);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-ice/50 px-3 py-2">
        <div>
          <div className="text-xs font-bold">{String(table.table_id ?? "table")}</div>
          <div className="text-[11px] text-gray-400">
            {String(table.table_type ?? "")}
            {table.model_key ? ` · ${String(table.model_key)}` : ""}
          </div>
        </div>
        {typeof provenance.source_url === "string" && (
          <a
            href={provenance.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-aqua-deep hover:underline"
          >
            источник <ExternalLink size={11} />
          </a>
        )}
      </div>

      {Object.keys(units).length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-3 py-2 text-[10px] text-gray-400">
          {Object.entries(units).map(([k, v]) => (
            <span key={k} className="rounded-full bg-white px-2 py-0.5">
              {k}: {String(v)}
            </span>
          ))}
        </div>
      )}

      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-white">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="border-b border-gray-100 px-3 py-2 font-semibold text-gray-400"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-gray-50/40">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-1.5 font-mono text-[11px]">
                    {fmt(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notes.length > 0 && (
        <ul className="space-y-1 border-t border-gray-100 px-3 py-2 text-[11px] text-gray-500">
          {notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AssortmentEditor({
  dataset,
  initial,
  schema,
  peers,
  familyVariants = [],
  relatedVariants: relatedFromFamily = [],
  backRole,
  initialTab,
}: {
  dataset: string;
  initial: CatalogProduct;
  schema: GroupSchema | null;
  peers: AssortmentPeer[];
  familyVariants?: VariantRow[];
  relatedVariants?: VariantRow[];
  backRole?: string;
  initialTab?: string;
}) {
  const tabIds: TabId[] = [
    "design",
    "compat",
    "tables",
    "attrs",
    "ports",
    "meta",
  ];
  const [tab, setTab] = useState<TabId>(
    tabIds.includes(initialTab as TabId) ? (initialTab as TabId) : "compat",
  );

  const ds = useMemo(() => asObj(initial.design_selection), [initial]);
  const readiness = useMemo(() => asObj(initial.data_readiness), [initial]);
  const quality = useMemo(() => asObj(initial.quality), [initial]);
  const compatView = useMemo(
    () => parseCompatibility(initial.compatibility),
    [initial],
  );
  const options = useMemo(
    () =>
      Array.isArray(ds.configuration_options)
        ? (ds.configuration_options as Record<string, unknown>[])
        : [],
    [ds],
  );
  const tables = useMemo(
    () =>
      (Array.isArray(initial.performance_tables)
        ? initial.performance_tables
        : []
      ).map((t) => asObj(t)),
    [initial],
  );
  const connections = useMemo(
    () => (Array.isArray(initial.connections) ? initial.connections : []),
    [initial],
  );
  const attrs = useMemo(() => initial.attributes ?? {}, [initial]);
  const fieldStatus = useMemo(() => initial.field_status ?? {}, [initial]);

  const attrDefs = useMemo(() => {
    const defs = schema?.attributes ?? [];
    const byId = new Map(defs.map((d) => [d.attribute_id, d]));
    const keys = [
      ...defs.map((d) => d.attribute_id),
      ...Object.keys(attrs).filter((k) => !byId.has(k)),
    ];
    return keys.map((id) => {
      const def: AttributeDef =
        byId.get(id) ??
        ({
          attribute_id: id,
          name: { ru: id, de: id },
          data_type: "string",
        } as AttributeDef);
      return def;
    });
  }, [schema, attrs]);

  const title = assortmentDisplayName(initial as unknown as Record<string, unknown>);
  const fullName = loc(initial.name, "de") || loc(initial.name, "ru");
  const images = initial.media?.images ?? [];
  const docs = initial.media?.documents ?? [];

  const backQs = new URLSearchParams({ db: dataset });
  if (backRole) backQs.set("role", backRole);
  const backHref = `/produkte?${backQs.toString()}`;

  const compatCount =
    compatView.compatibleIds.length +
    compatView.conditionalIds.length +
    compatView.portMatches.length;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "design", label: "Design", count: options.length || undefined },
    {
      id: "compat",
      label: "Совместимость",
      count: compatCount || undefined,
    },
    { id: "tables", label: "Таблицы", count: tables.length || undefined },
    { id: "attrs", label: "Атрибуты", count: Object.keys(attrs).length },
    { id: "ports", label: "Порты", count: connections.length },
    { id: "meta", label: "Источник" },
  ];

  const blockers = [
    ...(Array.isArray(ds.selection_blockers)
      ? (ds.selection_blockers as string[])
      : []),
    ...(Array.isArray(readiness.blockers)
      ? (readiness.blockers as string[])
      : []),
  ];

  const sourceExtra = asObj(initial.source);
  const shopVariants = useMemo((): VariantRow[] => {
    if (familyVariants.length > 0) return familyVariants;
    const raw = sourceExtra.sibling_variants;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => {
      const o = asObj(x);
      const productId = typeof o.product_id === "string" ? o.product_id : null;
      return {
        article: typeof o.article === "string" ? o.article : null,
        variant: typeof o.variant === "string" ? o.variant : null,
        price_eur: typeof o.price_eur === "number" ? o.price_eur : null,
        product_id: productId,
        in_assortment:
          o.in_assortment === undefined
            ? Boolean(productId)
            : Boolean(o.in_assortment),
        role: typeof o.role === "string" ? o.role : null,
        image_url: typeof o.image_url === "string" ? o.image_url : null,
      };
    });
  }, [familyVariants, sourceExtra.sibling_variants]);

  const shopPreview = useMemo((): VariantRow[] => {
    const raw = sourceExtra.sibling_variants_preview;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => {
      const o = asObj(x);
      const productId = typeof o.product_id === "string" ? o.product_id : null;
      return {
        article: typeof o.article === "string" ? o.article : null,
        variant: typeof o.variant === "string" ? o.variant : null,
        price_eur: typeof o.price_eur === "number" ? o.price_eur : null,
        product_id: productId,
        in_assortment:
          o.in_assortment === undefined
            ? Boolean(productId)
            : Boolean(o.in_assortment),
        image_url: typeof o.image_url === "string" ? o.image_url : null,
      };
    });
  }, [sourceExtra.sibling_variants_preview]);

  const relatedVariants = useMemo((): VariantRow[] => {
    if (relatedFromFamily.length > 0) return relatedFromFamily;
    const raw = sourceExtra.assortment_related;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => {
      const o = asObj(x);
      return {
        article: typeof o.article === "string" ? o.article : null,
        variant: typeof o.variant === "string" ? o.variant : null,
        price_eur: typeof o.price_eur === "number" ? o.price_eur : null,
        product_id: typeof o.product_id === "string" ? o.product_id : null,
        in_assortment:
          o.in_assortment === undefined ? true : Boolean(o.in_assortment),
        role: typeof o.role === "string" ? o.role : null,
      };
    });
  }, [relatedFromFamily, sourceExtra.assortment_related]);

  const shopTotal =
    familyVariants.length > 0
      ? familyVariants.length
      : typeof sourceExtra.sibling_variants_total === "number"
        ? sourceExtra.sibling_variants_total
        : shopVariants.length;
  const variantCount = shopTotal + relatedVariants.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-aqua-deep"
        >
          <ArrowLeft size={15} />
          {datasetLabel(dataset)}
        </Link>
      </div>

      {/* Hero */}
      <div className="mt-6 grid gap-5 sm:grid-cols-[140px_1fr]">
        <div className="flex h-36 items-center justify-center overflow-hidden rounded-3xl border border-gray-100 bg-white sm:h-auto">
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[0]}
              alt=""
              className="max-h-40 w-full object-contain p-3"
            />
          ) : (
            <span className="text-xs text-gray-400">нет фото</span>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-forest px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {roleLabel(String(ds.component_role))}
            </span>
            {statusPill(
              Boolean(ds.automatic_layout_eligible),
              "layout eligible",
              "не для layout",
            )}
            {statusPill(
              Boolean(quality.calculation_ready),
              "calc ready",
              "calc not ready",
            )}
            {compatView.compatibleIds.length > 0 && (
              <span className="rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-semibold text-aqua-deep">
                {compatView.compatibleIds.length} совместимы
              </span>
            )}
            {compatView.status && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  compatView.status === "ready" ||
                  compatView.status.startsWith("ready")
                    ? "bg-mint text-aqua-deep"
                    : "bg-ice text-forest-mid"
                }`}
              >
                {compatView.status}
              </span>
            )}
            {compatView.conditionalIds.length > 0 && (
              <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-[11px] font-semibold text-forest">
                {compatView.conditionalIds.length} conditional
              </span>
            )}
            {Boolean(quality.needs_review) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-[11px] font-semibold text-forest">
                <AlertTriangle size={11} />
                review
              </span>
            )}
            {variantCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ice px-2.5 py-0.5 text-[11px] font-semibold text-forest-mid">
                <Layers size={11} />
                {variantCount} вариант(ов)
              </span>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight">{title}</h1>
          {fullName && fullName !== title && (
            <p className="mt-1 text-sm text-gray-500">{fullName}</p>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Kv label="Артикул" value={initial.article || "—"} />
            <Kv
              label="Цена"
              value={
                formatPriceEur(
                  typeof initial.price_eur === "number"
                    ? initial.price_eur
                    : null,
                  typeof initial.price_text === "string"
                    ? initial.price_text
                    : null,
                ) || "—"
              }
            />
            <Kv label="Группа" value={initial.group_id} mono />
            <Kv label="ID" value={initial.product_id} mono />
          </div>

          {typeof initial.connection_note === "string" &&
            initial.connection_note.trim() && (
              <p className="mt-3 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-xs leading-relaxed text-forest">
                <span className="font-bold">Connection note: </span>
                {initial.connection_note}
              </p>
            )}

          {typeof ds.selection_summary_ru === "string" &&
            ds.selection_summary_ru && (
              <p className="mt-4 rounded-2xl border border-mint bg-mint/60 px-4 py-3 text-sm leading-relaxed text-forest">
                {ds.selection_summary_ru}
              </p>
            )}
        </div>
      </div>

      {(shopTotal > 0 || relatedVariants.length > 0) && (
        <div className="mt-6">
          <VariantOptionsPanel
            dataset={dataset}
            currentArticle={initial.article}
            currentVariant={
              initial.source?.source_variant || initial.model || null
            }
            currentProductId={initial.product_id}
            shopVariants={shopVariants}
            shopTotal={shopTotal}
            shopTruncated={
              familyVariants.length === 0 &&
              Boolean(sourceExtra.sibling_variants_truncated)
            }
            shopPreview={shopPreview}
            related={relatedVariants}
            sourceUrl={initial.source?.source_url}
            tab={tab}
            backRole={backRole}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-1 border-b border-gray-100 pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-2xl px-4 py-2 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "bg-white text-forest shadow-[0_-1px_0_0_white]"
                : "text-gray-400 hover:text-forest"
            }`}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1.5 text-[10px] opacity-60">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {tab === "design" && (
          <>
            <Section title="Роль в автопроектировании" hint="design_selection">
              <div className="grid gap-4 sm:grid-cols-2">
                <Kv
                  label="component_role"
                  value={roleLabel(String(ds.component_role))}
                />
                <Kv
                  label="configuration_mode"
                  value={fmt(ds.configuration_mode)}
                  mono
                />
                <Kv
                  label="selection_data_status"
                  value={fmt(ds.selection_data_status)}
                  mono
                />
                <Kv
                  label="option selection"
                  value={
                    ds.automatic_option_selection_eligible
                      ? "eligible"
                      : "нет"
                  }
                />
              </div>

              {blockers.length > 0 && (
                <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2.5">
                  <div className="text-[11px] font-bold text-forest">
                    Blockers
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                    {blockers.map((b) => (
                      <li key={b}>· {b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Object.keys(asObj(ds.selection_inputs)).length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-bold text-gray-400">
                    selection_inputs
                  </div>
                  <NestedObject data={ds.selection_inputs} />
                </div>
              )}
            </Section>

            <Section
              title="Data readiness"
              hint="готовность к расчёту / сборке"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  "identity_status",
                  "connection_status",
                  "hydraulic_status",
                  "compatibility_status",
                  "bom_status",
                  "automatic_layout_status",
                ].map((k) => (
                  <Kv key={k} label={k} value={fmt(readiness[k])} mono />
                ))}
              </div>
            </Section>

            <Section
              title="Configuration options"
              hint={
                options.length
                  ? `${options.length} вариант(ов)`
                  : "фиксированный компонент"
              }
            >
              {Object.keys(asObj(ds.option_set)).length > 0 && (
                <div className="mb-4 rounded-2xl border border-mint bg-mint/40 p-3">
                  <div className="mb-2 text-[11px] font-bold text-aqua-deep">
                    option_set
                  </div>
                  <NestedObject data={ds.option_set} />
                </div>
              )}

              {options.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Внутренних опций нет — режим{" "}
                  <span className="font-mono text-xs">
                    {fmt(ds.configuration_mode)}
                  </span>
                </p>
              ) : (
                <div className="space-y-4">
                  {options.map((opt, i) => {
                    const installed = asObj(opt.installed_option);
                    const physical = asObj(opt.physical_variant);
                    const coverage = asObj(opt.coverage);
                    const hydraulics = asObj(opt.hydraulics);
                    return (
                      <div
                        key={String(opt.configuration_id ?? i)}
                        className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Layers size={14} className="text-aqua-deep" />
                          <span className="text-sm font-bold">
                            {String(opt.configuration_id ?? `option-${i + 1}`)}
                          </span>
                          {typeof physical.catalog_availability === "string" && (
                            <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-aqua-deep">
                              {String(physical.catalog_availability)}
                            </span>
                          )}
                          {typeof installed.nozzle_size !== "undefined" && (
                            <span className="rounded-full bg-ice px-2 py-0.5 text-[10px] font-semibold text-forest-mid">
                              nozzle {fmt(installed.nozzle_size)}
                            </span>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {Object.keys(installed).length > 0 && (
                            <div>
                              <div className="mb-1 text-[10px] font-bold uppercase text-gray-400">
                                installed_option
                              </div>
                              <NestedObject data={installed} />
                            </div>
                          )}
                          {Object.keys(physical).length > 0 && (
                            <div>
                              <div className="mb-1 text-[10px] font-bold uppercase text-gray-400">
                                physical_variant
                              </div>
                              <NestedObject data={physical} />
                            </div>
                          )}
                          {Object.keys(coverage).length > 0 && (
                            <div className="sm:col-span-2">
                              <div className="mb-1 text-[10px] font-bold uppercase text-gray-400">
                                coverage
                              </div>
                              <NestedObject data={coverage} />
                            </div>
                          )}
                          {Object.keys(hydraulics).length > 0 && (
                            <div className="sm:col-span-2">
                              <div className="mb-1 text-[10px] font-bold uppercase text-gray-400">
                                hydraulics
                              </div>
                              <NestedObject data={hydraulics} />
                            </div>
                          )}
                        </div>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-[11px] font-semibold text-gray-400">
                            полный JSON опции
                          </summary>
                          <div className="mt-2">
                            <NestedObject data={opt} />
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {Array.isArray(ds.related_commercial_variants) &&
              ds.related_commercial_variants.length > 0 && (
                <Section
                  title="Related commercial variants"
                  hint="отдельные физ. варианты / бандлы"
                >
                  <div className="space-y-3">
                    {(ds.related_commercial_variants as unknown[]).map(
                      (v, i) => {
                        const o = asObj(v);
                        const linked =
                          typeof o.catalog_product_id === "string"
                            ? o.catalog_product_id
                            : "";
                        return (
                          <div
                            key={String(o.model ?? i)}
                            className="rounded-2xl border border-gray-100 bg-gray-50/40 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold">
                                {fmt(o.model)}
                              </span>
                              {o.automatic_selection_eligible === false && (
                                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-forest">
                                  не для auto
                                </span>
                              )}
                              {typeof o.catalog_availability === "string" && (
                                <span className="rounded-full bg-ice px-2 py-0.5 text-[10px] text-gray-500">
                                  {o.catalog_availability}
                                </span>
                              )}
                            </div>
                            {typeof o.selection_rule === "string" && (
                              <p className="mt-1.5 text-xs text-gray-600">
                                {o.selection_rule}
                              </p>
                            )}
                            {linked && (
                              <Link
                                href={`/produkte/${encodeURIComponent(linked)}?db=${encodeURIComponent(dataset)}`}
                                className="mt-2 inline-block text-xs font-semibold text-aqua-deep hover:underline"
                              >
                                → {linked}
                              </Link>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                </Section>
              )}
          </>
        )}

        {tab === "compat" && (
          <CompatibilityPanel
            compatibility={initial.compatibility}
            peers={peers}
            dataset={dataset}
          />
        )}

        {tab === "tables" && (
          <Section title="Performance tables" hint={`${tables.length}`}>
            {tables.length === 0 ? (
              <p className="text-sm text-gray-400">Таблиц нет</p>
            ) : (
              <div className="space-y-4">
                {tables.map((t, i) => (
                  <PerfTable key={String(t.table_id ?? i)} table={t} />
                ))}
              </div>
            )}
          </Section>
        )}

        {tab === "attrs" && (
          <Section
            title="Атрибуты"
            hint={schema ? schema.group_id : "без схемы группы"}
          >
            <div className="space-y-2">
              {attrDefs.map((def) => {
                const key = def.attribute_id;
                const val = attrs[key];
                const st = fieldStatus[`attributes.${key}`] ?? fieldStatus[key];
                const empty = val === null || val === undefined || val === "";
                return (
                  <div
                    key={key}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border px-3 py-2.5 ${
                      def.critical_for_calculation && empty
                        ? "border-gold/50 bg-gold/5"
                        : "border-gray-100 bg-gray-50/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold">
                          {attrLabel(def)}
                        </span>
                        {def.unit && (
                          <span className="text-[10px] text-gray-400">
                            ({def.unit})
                          </span>
                        )}
                        {def.critical_for_calculation && (
                          <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-forest">
                            critical
                          </span>
                        )}
                        {st && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] text-gray-400">
                            {st}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 break-words font-mono text-xs text-forest">
                        {fmt(val)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {tab === "ports" && (
          <Section title="Connections" hint={`${connections.length} порт(ов)`}>
            {typeof initial.connection_note === "string" &&
              initial.connection_note.trim() && (
                <p className="mb-4 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-forest">
                  {initial.connection_note}
                </p>
              )}
            {connections.length === 0 ? (
              <p className="text-sm text-gray-400">Порты не заданы</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {connections.map((c, i) => {
                  const portId = String(c.port_id ?? `port-${i + 1}`);
                  const threadStatus =
                    fieldStatus[`connections.${portId}.thread_standard`] ??
                    fieldStatus["connections.thread_standard"] ??
                    fieldStatus.connections;
                  const thread = c.thread_standard;
                  const threadUnresolved =
                    thread === "source_not_specified" ||
                    thread === "variant_not_resolved" ||
                    !thread;
                  return (
                    <div
                      key={portId}
                      className={`rounded-2xl border p-3 ${
                        threadUnresolved && c.connection_type === "threaded"
                          ? "border-gold/50 bg-gold/5"
                          : "border-gray-100 bg-gray-50/40"
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                        <Link2 size={13} className="text-aqua-deep" />
                        {portId}
                        {typeof thread === "string" &&
                          thread !== "not_applicable" && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                threadUnresolved
                                  ? "bg-gold/20 text-forest"
                                  : "bg-mint text-aqua-deep"
                              }`}
                            >
                              {thread}
                              {threadStatus ? ` · ${threadStatus}` : ""}
                            </span>
                          )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            "role",
                            "connection_type",
                            "thread_size_inch",
                            "thread_gender",
                            "thread_standard",
                            "nominal_size_mm",
                          ] as const
                        ).map((k) =>
                          c[k] !== undefined && c[k] !== null ? (
                            <Kv key={k} label={k} value={fmt(c[k])} mono />
                          ) : null,
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {tab === "meta" && (
          <>
            <Section title="Источник">
              <div className="grid gap-3 sm:grid-cols-2">
                <Kv label="source_name" value={initial.source?.source_name || "—"} />
                <Kv
                  label="category"
                  value={initial.source?.source_category || "—"}
                />
                <div className="sm:col-span-2">
                  <Kv
                    label="URL"
                    value={
                      initial.source?.source_url ? (
                        <a
                          href={initial.source.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-aqua-deep hover:underline"
                        >
                          {initial.source.source_url}
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                </div>
              </div>
            </Section>

            <Section title="Медиа" hint={`${images.length} img · ${docs.length} docs`}>
              {images.length > 1 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {images.slice(1).map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt=""
                      className="h-20 w-20 rounded-2xl border border-gray-100 object-contain bg-white p-1"
                    />
                  ))}
                </div>
              )}
              {docs.length === 0 ? (
                <p className="text-sm text-gray-400">Документов нет</p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li key={d.url}>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-aqua-deep hover:underline"
                      >
                        <FileText size={14} />
                        {d.title || d.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {Array.isArray(quality.warnings) &&
              quality.warnings.length > 0 && (
                <Section title="Warnings" hint="quality">
                  <ul className="space-y-2 text-xs text-gray-600">
                    {quality.warnings.map((w, i) => {
                      if (typeof w === "string") {
                        return (
                          <li
                            key={i}
                            className="rounded-2xl border border-gold/30 bg-gold/5 px-3 py-2"
                          >
                            {w}
                          </li>
                        );
                      }
                      const o = asObj(w);
                      return (
                        <li
                          key={i}
                          className="rounded-2xl border border-gold/30 bg-gold/5 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                            {typeof o.code === "string" && (
                              <span className="font-mono">{o.code}</span>
                            )}
                            {typeof o.severity === "string" && (
                              <span className="rounded-full bg-gold/20 px-1.5 py-0.5 font-semibold text-forest">
                                {o.severity}
                              </span>
                            )}
                          </div>
                          {typeof o.message === "string" ? (
                            <p className="mt-1 text-sm text-forest">{o.message}</p>
                          ) : (
                            <NestedObject data={w} />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Section>
              )}
          </>
        )}
      </div>

      {/* Quick jump footer */}
      <div className="mt-8 flex flex-wrap gap-2 text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Table2 size={11} /> {tables.length} tables
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Layers size={11} /> {options.length} options
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Link2 size={11} /> {connections.length} ports
        </span>
      </div>
    </div>
  );
}
