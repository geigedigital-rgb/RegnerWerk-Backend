"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  Layers,
  Search,
  SlidersHorizontal,
  Table2,
  GitBranch,
  X,
} from "lucide-react";
import {
  compatStatusShort,
  formatPriceEur,
  isCompatReady,
  roleLabel,
  type AssortmentAudit,
  type AssortmentListItem,
  type RoleNavItem,
} from "@/lib/assortment";
import { datasetLabel } from "@/lib/dataset-labels";

function connBadge(status: string): { label: string; cls: string } {
  if (status.includes("confirmed"))
    return { label: "conn ✓", cls: "bg-mint text-aqua-deep" };
  if (status.includes("partial"))
    return { label: "conn ~", cls: "bg-gold/15 text-forest" };
  if (status.includes("not_applicable"))
    return { label: "n/a", cls: "bg-gray-50 text-gray-400" };
  return { label: "conn ?", cls: "bg-gray-50 text-gray-400" };
}

export function AssortmentList({
  items,
  roles,
  audit,
  generatedAt,
  schemaVersion,
  datasets,
  dataset,
  initialRole,
}: {
  items: AssortmentListItem[];
  roles: RoleNavItem[];
  audit: AssortmentAudit;
  generatedAt: string;
  schemaVersion: string;
  datasets: string[];
  dataset: string;
  initialRole?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(initialRole ?? "");
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [onlyReview, setOnlyReview] = useState(false);
  const [onlyOptions, setOnlyOptions] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((i) => {
      if (role && i.role !== role) return false;
      if (onlyEligible && !i.layoutEligible) return false;
      if (onlyReview && !i.needsReview) return false;
      if (onlyOptions && i.optionsCount === 0) return false;
      if (!q) return true;
      const hay =
        `${i.title} ${i.brand} ${i.model} ${i.article} ${i.product_id} ${i.summaryRu} ${i.group_id}`.toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [items, query, role, onlyEligible, onlyReview, onlyOptions]);

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Universal ≤500 м²
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {items.length} позиций
            {schemaVersion && <> · schema {schemaVersion}</>}
            {generatedAt && <> · {generatedAt}</>}
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
          </div>
        )}
      </div>

      {/* Audit strip */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Авто-раскладка"
          value={audit.layoutEligible}
          hint={`из ${audit.productsTotal}`}
          accent
        />
        <Stat
          label="Compat ready"
          value={audit.compatReady}
          hint={`+${audit.compatConditional} conditional`}
          accent
        />
        <Stat
          label="Port pairs"
          value={audit.confirmedPortPairs}
          hint={`+${audit.conditionalPortPairs} cond · ${audit.functionalPairs} func`}
        />
        <Stat
          label="С опциями"
          value={audit.configurable}
          hint={`${audit.optionsTotal} опций`}
        />
        <Stat
          label="Connections"
          value={audit.connectionConfirmed}
          hint={`+${audit.connectionPartial} partial`}
        />
        <Stat
          label="На проверку"
          value={audit.needsReview}
          hint={
            audit.bomReady
              ? "BOM ready"
              : "BOM deferred"
          }
          warn
        />
      </div>

      {!audit.bomReady && audit.bomBlocker && (
        <div className="mt-3 rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-[11px] text-gray-500">
          <span className="font-semibold text-forest">Auto-BOM:</span>{" "}
          {audit.bomBlocker}
        </div>
      )}

      {audit.unresolved.length > 0 && (
        <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs text-forest">
          <div className="font-bold">Открытые вопросы аудита</div>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-gray-600">
            {audit.unresolved.slice(0, 4).map((u) => (
              <li key={u}>{u}</li>
            ))}
            {audit.unresolved.length > 4 && (
              <li>…ещё {audit.unresolved.length - 4}</li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Role nav */}
        <aside className="space-y-1 lg:sticky lg:top-6 lg:self-start">
          <button
            type="button"
            onClick={() => setFilter(setRole, "")}
            className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition-colors ${
              !role
                ? "bg-forest text-white"
                : "text-gray-600 hover:bg-white hover:text-forest"
            }`}
          >
            <span className="font-semibold">Все роли</span>
            <span className="text-xs opacity-70">{items.length}</span>
          </button>
          {roles.map((r) => (
            <button
              key={r.role}
              type="button"
              onClick={() => setFilter(setRole, r.role)}
              className={`flex w-full items-start justify-between gap-2 rounded-2xl px-3 py-2 text-left text-sm transition-colors ${
                role === r.role
                  ? "bg-forest text-white"
                  : "text-gray-600 hover:bg-white hover:text-forest"
              }`}
            >
              <span>
                <span className="font-semibold">{r.label}</span>
                {r.eligible > 0 && (
                  <span
                    className={`mt-0.5 block text-[10px] ${
                      role === r.role ? "text-lime" : "text-aqua-deep"
                    }`}
                  >
                    {r.eligible} eligible
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs opacity-70">{r.count}</span>
            </button>
          ))}
        </aside>

        <div>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={query}
                onChange={(e) => setFilter(setQuery, e.target.value)}
                placeholder="Поиск: модель, артикул, роль…"
                className="w-full rounded-full border border-gray-100 bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus:border-aqua-deep"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setFilter(setQuery, "")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-forest"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Toggle
              active={onlyEligible}
              onClick={() => setFilter(setOnlyEligible, !onlyEligible)}
              icon={<Layers size={13} />}
              label="Eligible"
            />
            <Toggle
              active={onlyOptions}
              onClick={() => setFilter(setOnlyOptions, !onlyOptions)}
              icon={<SlidersHorizontal size={13} />}
              label="Опции"
            />
            <Toggle
              active={onlyReview}
              onClick={() => setFilter(setOnlyReview, !onlyReview)}
              icon={<AlertTriangle size={13} />}
              label="Review"
            />
          </div>

          <p className="mt-3 text-xs text-gray-400">
            {filtered.length} из {items.length}
            {role && <> · {roleLabel(role)}</>}
          </p>

          <div className="mt-4 space-y-2">
            {pageItems.map((item) => {
              const conn = connBadge(item.connectionStatus);
              return (
                <Link
                  key={item.product_id}
                  href={`/produkte/${encodeURIComponent(item.product_id)}${dbQuery}${
                    role ? `&role=${encodeURIComponent(role)}` : ""
                  }`}
                  className="group flex gap-3 rounded-3xl border border-gray-100 bg-white p-3 transition-colors hover:border-aqua-deep/40 sm:p-4"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-ice sm:h-20 sm:w-20">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt=""
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-gray-400">
                        нет фото
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold group-hover:text-aqua-deep">
                          {item.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
                          <span className="font-medium text-forest-mid">
                            {roleLabel(item.role)}
                          </span>
                          {item.article && <span>Art. {item.article}</span>}
                          {(item.priceEur != null || item.priceText) && (
                            <span className="font-semibold text-forest">
                              {formatPriceEur(item.priceEur, item.priceText)}
                            </span>
                          )}
                          <span className="font-mono text-[10px]">
                            {item.product_id}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className="mt-0.5 shrink-0 text-gray-300 transition-colors group-hover:text-aqua-deep"
                      />
                    </div>

                    {item.summaryRu && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-600">
                        {item.summaryRu}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.layoutEligible && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-aqua-deep">
                          <CheckCircle2 size={10} />
                          layout
                        </span>
                      )}
                      {item.optionsCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ice px-2 py-0.5 text-[10px] font-semibold text-forest-mid">
                          <SlidersHorizontal size={10} />
                          {item.optionsCount} opt
                        </span>
                      )}
                      {item.tablesCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ice px-2 py-0.5 text-[10px] font-semibold text-forest-mid">
                          <Table2 size={10} />
                          {item.tablesCount} tbl
                        </span>
                      )}
                      {(item.compatConfirmed > 0 ||
                        item.compatConditional > 0) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-aqua-deep">
                          <GitBranch size={10} />
                          {item.compatConfirmed > 0 && (
                            <>{item.compatConfirmed} ok</>
                          )}
                          {item.compatConfirmed > 0 &&
                            item.compatConditional > 0 &&
                            " · "}
                          {item.compatConditional > 0 && (
                            <>{item.compatConditional} ~</>
                          )}
                        </span>
                      )}
                      {item.compatStatus && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isCompatReady(item.compatStatus)
                              ? "bg-mint/70 text-aqua-deep"
                              : "bg-gray-50 text-gray-400"
                          }`}
                          title={item.compatStatus}
                        >
                          {compatStatusShort(item.compatStatus)}
                        </span>
                      )}
                      {item.threadStandards.map((ts) => (
                        <span
                          key={ts}
                          className="rounded-full bg-ice px-2 py-0.5 text-[10px] font-semibold text-forest-mid"
                        >
                          {ts}
                        </span>
                      ))}
                      {item.hasConnectionNote && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-forest">
                          port note
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${conn.cls}`}
                      >
                        {conn.label}
                      </span>
                      {item.variantCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ice px-2 py-0.5 text-[10px] font-semibold text-forest-mid">
                          <Layers size={10} />
                          {item.variantCount} var
                        </span>
                      )}
                      {item.needsReview && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-forest">
                          <AlertTriangle size={10} />
                          review
                        </span>
                      )}
                      {item.blockers.length > 0 && (
                        <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] text-gray-400">
                          {item.blockers.length} blocker
                          {item.blockers.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}

            {pageItems.length === 0 && (
              <div className="rounded-3xl border border-dashed border-gray-100 bg-white px-6 py-16 text-center text-sm text-gray-400">
                Ничего не найдено
              </div>
            )}
          </div>

          {pageCount > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-full border border-gray-100 bg-white px-4 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                ←
              </button>
              <span className="text-xs text-gray-400">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="rounded-full border border-gray-100 bg-white px-4 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
  warn,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border px-4 py-3 ${
        accent
          ? "border-aqua-deep/30 bg-mint"
          : warn
            ? "border-gold/40 bg-gold/10"
            : "border-gray-100 bg-white"
      }`}
    >
      <div className="text-[11px] font-medium text-gray-400">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
        active
          ? "border-forest bg-forest text-white"
          : "border-gray-100 bg-white text-gray-600 hover:border-aqua-deep/40"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
