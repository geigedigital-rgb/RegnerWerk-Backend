import {
  buildRoleNav,
  isAssortmentRecord,
  parseAssortmentAudit,
  toAssortmentListItem,
} from "@/lib/assortment";
import {
  asCatalogProduct,
  buildNav,
  isCatalogProduct,
  toCatalogListItem,
} from "@/lib/catalog";
import { loadTaxonomy } from "@/lib/catalog-io";
import {
  DEFAULT_DATASET,
  datasetKind,
  listDatasets,
  makeKey,
  readDataset,
  recordId,
  resolveDataset,
  splitRecord,
} from "@/lib/db";
import type { CatalogListItem, ProductListItem } from "@/lib/types";
import { AssortmentList } from "@/components/AssortmentList";
import { CatalogList } from "@/components/CatalogList";
import { ProductList } from "@/components/ProductList";

export const dynamic = "force-dynamic";

function formatGeneratedAt(value: unknown): string {
  if (typeof value !== "string") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function ProduktePage({
  searchParams,
}: PageProps<"/produkte">) {
  const params = await searchParams;
  const requested = typeof params.db === "string" ? params.db : DEFAULT_DATASET;
  const initialGroup =
    typeof params.group === "string" ? params.group : undefined;
  const initialRole =
    typeof params.role === "string" ? params.role : undefined;

  const datasets = await listDatasets();
  const dataset = datasets.includes(requested)
    ? requested
    : datasets.includes(DEFAULT_DATASET)
      ? DEFAULT_DATASET
      : (datasets[0] ?? "");

  if (!dataset) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-gray-600 sm:px-6 lg:px-8">
        Не найдено ни одной базы в data/. Запустите catalog/scrape-пайплайн во
        фронтенд-репозитории.
      </div>
    );
  }

  const file = await resolveDataset(dataset);
  if (!file) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-gray-600">
        База не найдена.
      </div>
    );
  }

  const db = await readDataset(file);
  const generatedAt = formatGeneratedAt(db.generated_at ?? db.generatedAt);
  const kind = datasetKind(dataset);

  if (kind === "assortment") {
    const items = db.products
      .filter(isAssortmentRecord)
      .map(toAssortmentListItem);
    const roles = buildRoleNav(items);
    const audit = parseAssortmentAudit(db as Record<string, unknown>);
    const schemaVersion =
      typeof db.schema_version === "string" ? db.schema_version : "";

    return (
      <AssortmentList
        items={items}
        roles={roles}
        audit={audit}
        generatedAt={generatedAt}
        schemaVersion={schemaVersion}
        datasets={datasets}
        dataset={dataset}
        initialRole={initialRole}
      />
    );
  }

  if (kind === "catalog") {
    const catalogItems: CatalogListItem[] = db.products
      .filter(isCatalogProduct)
      .map((p) => toCatalogListItem(asCatalogProduct(p)));

    const taxonomy = await loadTaxonomy();
    const nav = buildNav(taxonomy, catalogItems);

    return (
      <CatalogList
        items={catalogItems}
        nav={nav}
        generatedAt={generatedAt}
        datasets={datasets}
        dataset={dataset}
        initialGroup={initialGroup}
      />
    );
  }

  // Legacy raw AI products
  const seen = new Map<string, number>();
  const items: ProductListItem[] = db.products.map((raw, index) => {
    const id = recordId(raw);
    const occurrence = seen.get(id) ?? 0;
    seen.set(id, occurrence + 1);
    const { product } = splitRecord(raw);
    return {
      key: makeKey(id, occurrence, index),
      id,
      title:
        product.title ||
        String(raw.name ?? raw.title ?? id ?? `#${index}`),
      category: product.category,
      image: product.images[0] ?? null,
      imageCount: product.images.length,
      pdfCount: product.pdfs.length,
      variantCount: product.variants.length,
      textLength: product.text.length,
    };
  });

  return (
    <ProductList
      items={items}
      generatedAt={generatedAt}
      datasets={datasets}
      dataset={dataset}
    />
  );
}
