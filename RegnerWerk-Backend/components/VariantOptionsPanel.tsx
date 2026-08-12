"use client";

import Link from "next/link";
import { Check, ExternalLink, Layers, Package } from "lucide-react";
import { formatPriceEur } from "@/lib/assortment";

export type VariantRow = {
  article: string | null;
  variant: string | null;
  price_eur: number | null;
  product_id?: string | null;
  role?: string | null;
  in_assortment?: boolean;
  is_current?: boolean;
  image_url?: string | null;
};

function roleLabelRu(role: string | null | undefined): string | null {
  if (!role) return null;
  const map: Record<string, string> = {
    nozzle: "насадка",
    spray_body: "корпус",
    spray_kit: "комплект",
    rotor: "ротор",
    rotor_nozzle_set: "набор дюз",
  };
  return map[role] ?? role;
}

function shortVariantLabel(variant: string | null, article: string | null): string {
  if (!variant) return article || "—";
  // Prefer trailing size token: 1", 1/2", 3/4", 1 1/4"...
  const size = variant.match(/(\d+\s*\d*\/\d+"|\d+\/\d+"|\d+")\s*$/);
  if (size) return size[1].replace(/\s+/g, " ");
  if (variant.length <= 28) return variant;
  return `${variant.slice(0, 26)}…`;
}

function productHref(
  productId: string,
  dataset: string,
  tab?: string,
  backRole?: string,
): string {
  const qs = new URLSearchParams({ db: dataset });
  if (tab) qs.set("tab", tab);
  if (backRole) qs.set("role", backRole);
  return `/produkte/${encodeURIComponent(productId)}?${qs.toString()}`;
}

function markCurrent(
  rows: VariantRow[],
  current: {
    article?: string | null;
    variant?: string | null;
    productId?: string | null;
  },
): VariantRow[] {
  const article = current.article?.trim() || null;
  const variant = current.variant?.trim() || null;
  const productId = current.productId?.trim() || null;

  const marked = rows.map((r) => {
    const byId = Boolean(productId && r.product_id && r.product_id === productId);
    const byArticle = Boolean(article && r.article && r.article === article);
    const byVariant = Boolean(variant && r.variant && r.variant === variant);
    return {
      ...r,
      is_current: byId || byArticle || byVariant || Boolean(r.is_current),
    };
  });

  return [
    ...marked.filter((r) => r.is_current),
    ...marked.filter((r) => !r.is_current),
  ];
}

function VariantTable({
  rows,
  dataset,
  empty,
  tab,
  backRole,
}: {
  rows: VariantRow[];
  dataset: string;
  empty: string;
  tab?: string;
  backRole?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-ice/60 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            <th className="w-14 px-3 py-2" />
            <th className="px-3 py-2">Вариант</th>
            <th className="px-3 py-2">Art.Nr</th>
            <th className="px-3 py-2">Цена</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const inSet = Boolean(row.product_id) && row.in_assortment !== false;
            const href =
              row.product_id && inSet
                ? productHref(row.product_id, dataset, tab, backRole)
                : null;
            const role = roleLabelRu(row.role);
            const current = Boolean(row.is_current);
            return (
              <tr
                key={`${row.article ?? ""}-${row.variant ?? ""}-${i}`}
                className={
                  current
                    ? "border-b border-aqua-deep/20 bg-mint shadow-[inset_4px_0_0_0_var(--rw-forest)]"
                    : "border-b border-gray-50 bg-white last:border-0"
                }
              >
                <td className="px-2 py-2">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-ice/40">
                    {row.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.image_url}
                        alt=""
                        className="max-h-10 max-w-10 object-contain"
                      />
                    ) : (
                      <span className="text-[9px] text-gray-300">—</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div
                    className={
                      current
                        ? "font-bold text-forest"
                        : "font-medium text-forest"
                    }
                  >
                    {href && !current ? (
                      <Link
                        href={href}
                        scroll={false}
                        className="hover:text-aqua-deep hover:underline"
                      >
                        {row.variant || "—"}
                      </Link>
                    ) : (
                      row.variant || "—"
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-forest px-2 py-0.5 text-[10px] font-semibold text-lime">
                        <Check size={10} strokeWidth={2.5} />
                        открыт сейчас
                      </span>
                    )}
                    {role && (
                      <span className="rounded-full bg-ice px-1.5 py-0.5 text-[9px] font-semibold text-forest-mid">
                        {role}
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className={`px-3 py-2.5 font-mono text-xs ${
                    current ? "font-semibold text-forest" : "text-forest-mid"
                  }`}
                >
                  {row.article || "—"}
                </td>
                <td
                  className={`px-3 py-2.5 ${
                    current ? "font-semibold text-forest" : "text-forest-mid"
                  }`}
                >
                  {row.price_eur != null
                    ? formatPriceEur(row.price_eur)
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {current ? (
                    <span className="inline-flex items-center rounded-full border border-forest/20 bg-white px-2.5 py-1 text-[10px] font-bold text-forest">
                      текущий
                    </span>
                  ) : href ? (
                    <Link
                      href={href}
                      scroll={false}
                      className="rounded-full bg-forest px-3 py-1 text-[11px] font-semibold text-white hover:bg-forest-mid"
                    >
                      открыть
                    </Link>
                  ) : (
                    <span className="text-[10px] text-gray-300">не в наборе</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function VariantOptionsPanel({
  dataset,
  currentArticle,
  currentVariant,
  currentProductId,
  shopVariants,
  shopTotal,
  shopTruncated,
  shopPreview,
  related,
  sourceUrl,
  tab,
  backRole,
}: {
  dataset: string;
  currentArticle?: string | null;
  currentVariant?: string | null;
  currentProductId?: string | null;
  shopVariants: VariantRow[];
  shopTotal?: number;
  shopTruncated?: boolean;
  shopPreview?: VariantRow[];
  related: VariantRow[];
  sourceUrl?: string | null;
  tab?: string;
  backRole?: string;
}) {
  const current = {
    article: currentArticle,
    variant: currentVariant,
    productId: currentProductId,
  };

  const shopRows = markCurrent(
    shopTruncated && shopPreview?.length ? shopPreview : shopVariants,
    current,
  );
  const relatedRows = markCurrent(related, current);

  const switchable = shopRows.filter(
    (r) => r.product_id && r.in_assortment !== false,
  );

  const shopCount = shopTotal ?? shopVariants.length;
  const hasAnything = shopCount > 0 || relatedRows.length > 0;
  if (!hasAnything) return null;

  return (
    <section className="rounded-3xl border border-aqua-deep/20 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-forest">
            <Layers size={16} className="text-aqua-deep" />
            Варианты
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Переключайтесь между размерами / насадками — список остаётся на
            каждой карточке семейства.
          </p>
        </div>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-aqua-deep hover:underline"
          >
            страница магазина
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {switchable.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {switchable.map((row) => {
            const currentRow = Boolean(row.is_current);
            const label = shortVariantLabel(row.variant, row.article);
            const href = productHref(
              row.product_id!,
              dataset,
              tab,
              backRole,
            );
            if (currentRow) {
              return (
                <span
                  key={row.product_id}
                  className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-xs font-bold text-lime"
                >
                  <Check size={12} strokeWidth={2.5} />
                  {label}
                </span>
              );
            }
            return (
              <Link
                key={row.product_id}
                href={href}
                scroll={false}
                className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-forest transition-colors hover:border-aqua-deep/40 hover:bg-mint"
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {shopCount > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <Package size={12} />
            На странице магазина
            <span className="rounded-full bg-ice px-1.5 py-0.5 text-[10px] font-bold text-forest-mid normal-case tracking-normal">
              {shopCount}
            </span>
            {shopTruncated && (
              <span className="normal-case tracking-normal text-gold">
                показаны первые {shopRows.length}
              </span>
            )}
          </div>
          <VariantTable
            rows={shopRows}
            dataset={dataset}
            empty="Нет вариантов с страницы"
            tab={tab}
            backRole={backRole}
          />
        </div>
      )}

      {relatedRows.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <Layers size={12} />
            В этом ассортименте (брызговики / насадки)
            <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-bold text-aqua-deep normal-case tracking-normal">
              {relatedRows.length}
            </span>
          </div>
          <VariantTable
            rows={relatedRows}
            dataset={dataset}
            empty="Нет связанных позиций"
            tab={tab}
            backRole={backRole}
          />
        </div>
      )}
    </section>
  );
}
