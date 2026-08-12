import { notFound } from "next/navigation";
import {
  isAssortmentRecord,
  toAssortmentPeer,
} from "@/lib/assortment";
import {
  asCatalogProduct,
  isCatalogProduct,
} from "@/lib/catalog";
import { loadGroupSchemas, loadTaxonomy } from "@/lib/catalog-io";
import {
  DEFAULT_DATASET,
  datasetKind,
  getCatalogProduct,
  getProduct,
  readDataset,
  resolveDataset,
  splitRecord,
} from "@/lib/db";
import {
  resolveRelatedVariantFamily,
  resolveShopVariantFamily,
} from "@/lib/variants";
import { AssortmentEditor } from "@/components/AssortmentEditor";
import { CatalogEditor } from "@/components/CatalogEditor";
import { ProductEditor } from "@/components/ProductEditor";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/produkte/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const dataset = typeof sp.db === "string" ? sp.db : DEFAULT_DATASET;
  const backRole = typeof sp.role === "string" ? sp.role : undefined;
  const initialTab = typeof sp.tab === "string" ? sp.tab : undefined;
  const file = await resolveDataset(dataset);
  if (!file) notFound();

  const productKey = decodeURIComponent(id);
  const kind = datasetKind(dataset);

  if (kind === "assortment") {
    const db = await readDataset(file);
    const product = db.products.find(
      (p) =>
        typeof p.product_id === "string" && p.product_id === productKey,
    );
    if (!product || !isAssortmentRecord(product)) {
      notFound();
    }
    const catalog = asCatalogProduct(product);
    const peers = db.products
      .filter(isAssortmentRecord)
      .map(toAssortmentPeer);
    const familyVariants = resolveShopVariantFamily(product, db.products);
    const relatedVariants = resolveRelatedVariantFamily(product, db.products);
    const schemas = await loadGroupSchemas();
    const schema = schemas.get(catalog.group_id) ?? null;

    return (
      <AssortmentEditor
        dataset={dataset}
        initial={catalog}
        schema={schema}
        peers={peers}
        familyVariants={familyVariants}
        relatedVariants={relatedVariants}
        backRole={backRole}
        initialTab={initialTab}
      />
    );
  }

  if (kind === "catalog") {
    const product = await getCatalogProduct(file, productKey);
    if (
      !product ||
      !isCatalogProduct(product as unknown as Record<string, unknown>)
    ) {
      notFound();
    }
    const catalog = asCatalogProduct(
      product as unknown as Record<string, unknown>,
    );
    const [taxonomy, schemas] = await Promise.all([
      loadTaxonomy(),
      loadGroupSchemas(),
    ]);
    const schema = schemas.get(catalog.group_id) ?? null;

    return (
      <CatalogEditor
        dataset={dataset}
        initial={catalog}
        schema={schema}
        sections={taxonomy.sections}
        groups={taxonomy.groups}
      />
    );
  }

  const product = await getProduct(file, productKey);
  if (!product) notFound();

  const db = await readDataset(file);
  const categories = [
    ...new Set(
      db.products.map((p) => splitRecord(p).product.category).filter(Boolean),
    ),
  ].sort();

  return (
    <ProductEditor
      dataset={dataset}
      productKey={productKey}
      initial={product}
      categories={categories}
    />
  );
}
