/**
 * File-backed product store over RegnerWerk/data/.
 *
 * Admin datasets (selector): только catalog/normalized/products_*.json
 * с непустым products[]. Сырой scrape (data/raw/) в UI не показываем —
 * это вход пайплайна, не рабочий каталог.
 *
 * Writes snapshot the previous file to *.bak.
 *
 * Addressing:
 *  - catalog: by product_id (unique)
 *  - raw: by key `id` / `id@n` / `#i` (если открыть вручную через ?db=)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { isCatalogProduct } from "./catalog";
import { DATA_ROOT, DEFAULT_DATASET } from "./paths";
import type { AiProduct, CatalogProduct, ProductPdf } from "./types";

export { DATA_ROOT, DEFAULT_DATASET };
export { datasetLabel, DATASET_LABELS } from "./dataset-labels";

type RawRecord = Record<string, unknown>;

type RawFile = {
  products: RawRecord[];
  [key: string]: unknown;
};

/* ------------------------------------------------------------------ */
/* Datasets                                                            */
/* ------------------------------------------------------------------ */

/** Allowed product stores under catalog/normalized/. */
const CATALOG_PRODUCT_FILES = new Set([
  "RegnerWerk_universal.json",
  "products_assortment_500m2.json",
  "products_normalized.json",
  "products_needs_review.json",
  "products_unclassified.json",
]);

const DATASET_ORDER: Record<string, number> = {
  "RegnerWerk_universal.json": 0,
  "products_assortment_500m2.json": 1,
  "products_normalized.json": 2,
  "products_needs_review.json": 3,
  "products_unclassified.json": 4,
};

async function readProductsFile(
  rel: string,
): Promise<RawFile | null> {
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(DATA_ROOT, rel), "utf8"),
    ) as RawFile;
    if (!Array.isArray(raw.products)) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function listDatasets(): Promise<string[]> {
  const dir = path.join(DATA_ROOT, "catalog", "normalized");
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: { rel: string; order: number; count: number }[] = [];
  for (const e of entries) {
    if (!e.isFile() || !CATALOG_PRODUCT_FILES.has(e.name)) continue;
    const rel = `catalog/normalized/${e.name}`;
    const raw = await readProductsFile(rel);
    if (!raw) continue;
    if (raw.products.length === 0) continue;
    const order = DATASET_ORDER[e.name] ?? 99;
    out.push({ rel, order, count: raw.products.length });
  }
  return out.sort((a, b) => a.order - b.order || a.rel.localeCompare(b.rel)).map((x) => x.rel);
}

/**
 * Resolve a dataset path. Catalog product files from the allow-list always
 * resolve; other paths under DATA_ROOT are accepted only if they exist and
 * contain products[] (deep-link / legacy ?db=raw/...).
 */
export async function resolveDataset(name: string): Promise<string | null> {
  if (name.includes("..") || path.isAbsolute(name)) return null;
  const abs = path.join(DATA_ROOT, name);
  if (!abs.startsWith(DATA_ROOT + path.sep) && abs !== DATA_ROOT) return null;

  const base = path.basename(name);
  if (
    name.startsWith("catalog/normalized/") &&
    CATALOG_PRODUCT_FILES.has(base)
  ) {
    try {
      await fs.access(abs);
      return abs;
    } catch {
      return null;
    }
  }

  // Legacy / deep-link: allow existing product stores, but they won't appear
  // in the selector.
  const raw = await readProductsFile(name);
  return raw ? abs : null;
}

export function datasetKind(name: string): "assortment" | "catalog" | "raw" {
  const base = name.split("/").pop() ?? name;
  if (
    base.includes("assortment") ||
    /universal/i.test(base) ||
    base === "RegnerWerk_universal.json"
  ) {
    return "assortment";
  }
  if (name.startsWith("catalog/")) return "catalog";
  return "raw";
}

/** Assortment and normalized catalog share product_id CRUD. */
export function usesCatalogCrud(name: string): boolean {
  const kind = datasetKind(name);
  return kind === "assortment" || kind === "catalog";
}

/* ------------------------------------------------------------------ */
/* IO                                                                  */
/* ------------------------------------------------------------------ */

export async function readDataset(file: string): Promise<RawFile> {
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawFile;
  if (!Array.isArray(raw.products)) {
    throw new Error(`Нет массива products в ${path.basename(file)}`);
  }
  return raw;
}

async function writeDataset(file: string, db: RawFile): Promise<void> {
  await fs.copyFile(file, `${file}.bak`);
  await fs.writeFile(file, JSON.stringify(db, null, 1), "utf8");
}

/* ------------------------------------------------------------------ */
/* Catalog CRUD                                                        */
/* ------------------------------------------------------------------ */

export async function getCatalogProduct(
  file: string,
  productId: string,
): Promise<CatalogProduct | null> {
  const db = await readDataset(file);
  const raw = db.products.find(
    (p) => typeof p.product_id === "string" && p.product_id === productId,
  );
  return raw && isCatalogProduct(raw) ? (raw as CatalogProduct) : null;
}

export async function updateCatalogProduct(
  file: string,
  productId: string,
  product: CatalogProduct,
): Promise<CatalogProduct | null> {
  const db = await readDataset(file);
  const idx = db.products.findIndex(
    (p) => typeof p.product_id === "string" && p.product_id === productId,
  );
  if (idx === -1) return null;
  // Keep product_id immutable
  db.products[idx] = { ...product, product_id: productId };
  await writeDataset(file, db);
  return db.products[idx] as CatalogProduct;
}

export async function deleteCatalogProduct(
  file: string,
  productId: string,
): Promise<boolean> {
  const db = await readDataset(file);
  const before = db.products.length;
  db.products = db.products.filter((p) => p.product_id !== productId);
  if (db.products.length === before) return false;
  await writeDataset(file, db);
  return true;
}

/* ------------------------------------------------------------------ */
/* Legacy AiProduct split / merge                                      */
/* ------------------------------------------------------------------ */

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isPdfArray(v: unknown): v is ProductPdf[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as RawRecord).title === "string" &&
        typeof (x as RawRecord).url === "string",
    )
  );
}

const STANDARD_CHECKS: Record<string, (v: unknown) => boolean> = {
  id: (v) => typeof v === "string",
  url: (v) => typeof v === "string",
  title: (v) => typeof v === "string",
  category: (v) => typeof v === "string",
  variants: isStringArray,
  images: isStringArray,
  pdfs: isPdfArray,
  text: (v) => typeof v === "string",
};

export function splitRecord(raw: RawRecord): {
  product: AiProduct;
  standardKeys: string[];
} {
  const product: AiProduct = {
    id: "",
    url: "",
    title: "",
    category: "",
    variants: [],
    images: [],
    pdfs: [],
    text: "",
    extra: {},
  };
  const standardKeys: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    const check = STANDARD_CHECKS[key];
    if (check && check(value)) {
      standardKeys.push(key);
      (product as unknown as RawRecord)[key] = value;
    } else {
      product.extra[key] = value;
    }
  }
  return { product, standardKeys };
}

const EMPTY = (v: unknown) =>
  v === "" || (Array.isArray(v) && v.length === 0);

function mergeRecord(original: RawRecord, edited: AiProduct): RawRecord {
  const { standardKeys } = splitRecord(original);
  const standard: RawRecord = {
    id: original.id,
    url: edited.url,
    title: edited.title,
    category: edited.category,
    variants: edited.variants,
    images: edited.images,
    pdfs: edited.pdfs,
    text: edited.text,
  };

  const out: RawRecord = {};
  for (const key of Object.keys(original)) {
    if (standardKeys.includes(key)) out[key] = standard[key];
    else if (key in edited.extra) out[key] = edited.extra[key];
  }
  for (const [key, value] of Object.entries(edited.extra)) {
    if (!(key in out)) out[key] = value;
  }
  for (const [key, value] of Object.entries(standard)) {
    if (!(key in out) && !EMPTY(value) && value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

export function recordId(raw: RawRecord): string {
  return typeof raw.id === "string" ? raw.id : "";
}

export function makeKey(id: string, occurrence: number, index: number): string {
  if (!id) return `#${index}`;
  return occurrence === 0 ? id : `${id}@${occurrence}`;
}

function findIndexByKey(products: RawRecord[], key: string): number {
  if (key.startsWith("#")) {
    const idx = Number(key.slice(1));
    return Number.isInteger(idx) && idx >= 0 && idx < products.length
      ? idx
      : -1;
  }
  const m = key.match(/^(.+)@(\d+)$/);
  const id = m ? m[1] : key;
  const occurrence = m ? Number(m[2]) : 0;
  let seen = 0;
  for (let i = 0; i < products.length; i++) {
    if (recordId(products[i]) === id) {
      if (seen === occurrence) return i;
      seen++;
    }
  }
  return -1;
}

export async function getProduct(
  file: string,
  key: string,
): Promise<AiProduct | null> {
  const db = await readDataset(file);
  const idx = findIndexByKey(db.products, key);
  return idx === -1 ? null : splitRecord(db.products[idx]).product;
}

export async function updateProduct(
  file: string,
  key: string,
  product: AiProduct,
): Promise<AiProduct | null> {
  const db = await readDataset(file);
  const idx = findIndexByKey(db.products, key);
  if (idx === -1) return null;
  db.products[idx] = mergeRecord(db.products[idx], product);
  await writeDataset(file, db);
  return splitRecord(db.products[idx]).product;
}

export async function deleteProduct(
  file: string,
  key: string,
): Promise<boolean> {
  const db = await readDataset(file);
  const idx = findIndexByKey(db.products, key);
  if (idx === -1) return false;
  db.products.splice(idx, 1);
  await writeDataset(file, db);
  return true;
}
