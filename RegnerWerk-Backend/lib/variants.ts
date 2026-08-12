/**
 * Resolve shop sibling / related variant families across the assortment.
 * sibling_variants usually live only on one "owner" card — siblings need
 * the same list when switching between sizes.
 */
export type VariantFamilyRow = {
  article: string | null;
  variant: string | null;
  price_eur: number | null;
  product_id: string | null;
  role: string | null;
  in_assortment: boolean;
  image_url?: string | null;
};

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function parseSiblingRow(raw: unknown): VariantFamilyRow {
  const o = asRecord(raw);
  const productId = typeof o.product_id === "string" ? o.product_id : null;
  return {
    article: typeof o.article === "string" ? o.article : null,
    variant: typeof o.variant === "string" ? o.variant : null,
    price_eur: typeof o.price_eur === "number" ? o.price_eur : null,
    product_id: productId,
    role: typeof o.role === "string" ? o.role : null,
    in_assortment:
      o.in_assortment === undefined
        ? Boolean(productId)
        : Boolean(o.in_assortment),
    image_url: typeof o.image_url === "string" ? o.image_url : null,
  };
}

function siblingListOf(product: Record<string, unknown>): VariantFamilyRow[] {
  const source = asRecord(product.source);
  const raw = source.sibling_variants;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map(parseSiblingRow);
}

function relatedListOf(product: Record<string, unknown>): VariantFamilyRow[] {
  const source = asRecord(product.source);
  const raw = source.assortment_related;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((row) => {
    const parsed = parseSiblingRow(row);
    return {
      ...parsed,
      in_assortment:
        asRecord(row).in_assortment === undefined
          ? true
          : parsed.in_assortment,
    };
  });
}

function productAsVariantRow(
  product: Record<string, unknown>,
): VariantFamilyRow {
  const source = asRecord(product.source);
  const price =
    typeof product.price_eur === "number" ? product.price_eur : null;
  const media = asRecord(product.media);
  const images = Array.isArray(media.images) ? media.images : [];
  const imageUrl =
    typeof images[0] === "string"
      ? images[0]
      : typeof source.image_url === "string"
        ? source.image_url
        : null;
  return {
    article: typeof product.article === "string" ? product.article : null,
    variant:
      (typeof source.source_variant === "string" && source.source_variant) ||
      (typeof product.model === "string" && product.model) ||
      null,
    price_eur: price,
    product_id:
      typeof product.product_id === "string" ? product.product_id : null,
    role: null,
    in_assortment: true,
    image_url: imageUrl,
  };
}

/**
 * Shop-page size/nozzle family for the open card.
 * Falls back to another product that owns sibling_variants listing this id,
 * then to other cards with the same source_url.
 */
export function resolveShopVariantFamily(
  current: Record<string, unknown>,
  all: Record<string, unknown>[],
): VariantFamilyRow[] {
  const currentId =
    typeof current.product_id === "string" ? current.product_id : "";
  const own = siblingListOf(current);
  if (own.length > 0) return own;

  if (currentId) {
    for (const p of all) {
      if (p === current) continue;
      const list = siblingListOf(p);
      if (list.some((row) => row.product_id === currentId)) {
        return list;
      }
    }
  }

  const url = asRecord(current.source).source_url;
  if (typeof url === "string" && url) {
    const sameUrl = all.filter(
      (p) => asRecord(p.source).source_url === url,
    );
    if (sameUrl.length > 1) {
      return sameUrl.map(productAsVariantRow);
    }
  }

  return own;
}

export function resolveRelatedVariantFamily(
  current: Record<string, unknown>,
  all: Record<string, unknown>[],
): VariantFamilyRow[] {
  const currentId =
    typeof current.product_id === "string" ? current.product_id : "";
  const own = relatedListOf(current);
  if (own.length > 0) return own;

  if (!currentId) return [];

  for (const p of all) {
    if (p === current) continue;
    const list = relatedListOf(p);
    if (list.some((row) => row.product_id === currentId)) {
      return list;
    }
  }

  // If we are listed in someone's sibling_variants as related role, still empty —
  // related is separate. Also try: owner's assortment_related when we are in their siblings.
  for (const p of all) {
    const sibs = siblingListOf(p);
    if (sibs.some((row) => row.product_id === currentId)) {
      const related = relatedListOf(p);
      if (related.length > 0) return related;
    }
  }

  return [];
}
