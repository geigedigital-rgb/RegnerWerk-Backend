/**
 * Pure catalog helpers (safe for client components).
 * File IO lives in catalog-io.ts (server-only).
 */
import type {
  AttributeDef,
  CatalogListItem,
  CatalogProduct,
  Localized,
  Taxonomy,
  TaxonomyGroup,
  TaxonomySection,
} from "./types";

export type NavSection = {
  section_id: string;
  name: string;
  description: string;
  groups: {
    group_id: string;
    name: string;
    count: number;
    ready: number;
    review: number;
  }[];
  count: number;
};

export function loc(
  name: Localized | string | null | undefined,
  prefer: "ru" | "de" = "ru",
): string {
  if (!name) return "";
  if (typeof name === "string") return name;
  return (
    name[prefer] || name.de || name.ru || Object.values(name).find(Boolean) || ""
  );
}

export function isCatalogProduct(raw: Record<string, unknown>): boolean {
  return typeof raw.product_id === "string" && typeof raw.group_id === "string";
}

export function asCatalogProduct(raw: Record<string, unknown>): CatalogProduct {
  return raw as CatalogProduct;
}

export function catalogTitle(
  p: CatalogProduct,
  prefer: "ru" | "de" = "ru",
): string {
  const n = loc(p.name, prefer);
  if (n) return n;
  return (
    [p.brand, p.model || p.series].filter(Boolean).join(" ") || p.product_id
  );
}

/** Обрезка по границе слова — для заголовков карточек списка. */
export function truncateTitle(text: string, max = 56): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max - 1);
  const at = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf(","), slice.lastIndexOf("-"));
  const cut = at > max * 0.45 ? slice.slice(0, at) : slice;
  return `${cut.replace(/[\s,;:\-–—]+$/, "")}…`;
}

/**
 * Короткое имя для карточки списка.
 * Полные shop-названия (часто 100–200 символов) не годятся в UI.
 */
export function cardTitle(p: CatalogProduct, max = 56): string {
  const brand = (p.brand || p.manufacturer || "").trim();
  const model = (p.model || "").trim();
  const article = (p.article || "").trim();
  const full = catalogTitle(p, "de") || catalogTitle(p, "ru");

  // Короткий model без дубля бренда
  if (model && model.length <= max) {
    const withBrand =
      brand && !model.toLowerCase().startsWith(brand.toLowerCase())
        ? `${brand} ${model}`
        : model;
    if (withBrand.length <= max) return withBrand;
    return truncateTitle(model, max);
  }

  // brand · article — компактный fallback
  if (brand && article) {
    const compact = `${brand} · ${article}`;
    if (compact.length <= max) return compact;
  }

  return truncateTitle(full || model || brand || p.product_id, max);
}

export function toCatalogListItem(p: CatalogProduct): CatalogListItem {
  const status = p.field_status ?? {};
  let confirmedAttrs = 0;
  let missingCritical = 0;
  for (const [, v] of Object.entries(status)) {
    if (v === "confirmed") confirmedAttrs++;
  }
  const warnings = p.quality?.warnings ?? [];
  const critWarn = warnings.find((w) => w.startsWith("missing_critical:"));
  if (critWarn) {
    missingCritical = critWarn
      .replace("missing_critical:", "")
      .split(",")
      .filter(Boolean).length;
  } else {
    for (const [k, v] of Object.entries(status)) {
      if (v === "not_found" && k.startsWith("attributes.")) missingCritical++;
    }
  }

  const fullDe = catalogTitle(p, "de");
  const fullRu = catalogTitle(p, "ru");

  return {
    product_id: p.product_id,
    title: cardTitle(p, 56),
    titleDe: fullDe !== fullRu ? truncateTitle(fullDe, 72) : "",
    brand: p.brand || p.manufacturer || "",
    model: p.model || "",
    article: p.article || "",
    group_id: p.group_id,
    subtype_id: p.subtype_id || "",
    image: p.media?.images?.[0] ?? null,
    imageCount: p.media?.images?.length ?? 0,
    docCount: p.media?.documents?.length ?? 0,
    calculationReady: Boolean(p.quality?.calculation_ready),
    needsReview: Boolean(p.quality?.needs_review),
    warnings,
    confirmedAttrs,
    missingCritical,
  };
}

export function buildNav(
  taxonomy: Taxonomy,
  items: CatalogListItem[],
): NavSection[] {
  const byGroup = new Map<string, CatalogListItem[]>();
  for (const it of items) {
    const list = byGroup.get(it.group_id) ?? [];
    list.push(it);
    byGroup.set(it.group_id, list);
  }

  const groupsBySection = new Map<string, TaxonomyGroup[]>();
  for (const g of taxonomy.groups) {
    const list = groupsBySection.get(g.section_id) ?? [];
    list.push(g);
    groupsBySection.set(g.section_id, list);
  }

  return taxonomy.sections
    .map((s: TaxonomySection) => {
      const groups = (groupsBySection.get(s.section_id) ?? []).map((g) => {
        const list = byGroup.get(g.group_id) ?? [];
        return {
          group_id: g.group_id,
          name: loc(g.name, "ru"),
          count: list.length,
          ready: list.filter((x) => x.calculationReady).length,
          review: list.filter((x) => x.needsReview).length,
        };
      });
      const count = groups.reduce((n, g) => n + g.count, 0);
      return {
        section_id: s.section_id,
        name: loc(s.name, "ru"),
        description: s.description || "",
        groups,
        count,
      };
    })
    .filter((s) => s.groups.some((g) => g.count > 0));
}

export function attrLabel(def: AttributeDef): string {
  return loc(def.name, "ru") || def.attribute_id;
}

export function formatAttrValue(value: unknown, def?: AttributeDef): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (Array.isArray(value)) return value.join(", ");
  const unit = def?.unit ? ` ${def.unit}` : "";
  return `${String(value)}${unit}`;
}
