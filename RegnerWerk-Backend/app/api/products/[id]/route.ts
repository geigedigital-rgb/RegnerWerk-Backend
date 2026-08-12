import { NextRequest } from "next/server";
import {
  DEFAULT_DATASET,
  deleteCatalogProduct,
  deleteProduct,
  usesCatalogCrud,
  getCatalogProduct,
  getProduct,
  resolveDataset,
  updateCatalogProduct,
  updateProduct,
} from "@/lib/db";
import type { AiProduct, CatalogProduct, ProductPdf } from "@/lib/types";

function str(v: unknown): v is string {
  return typeof v === "string";
}

function parseAiProduct(body: unknown): AiProduct | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!str(b.title) || !str(b.category) || !str(b.url) || !str(b.text))
    return null;

  const variants = Array.isArray(b.variants)
    ? b.variants.filter(str).map((v) => v.trim()).filter(Boolean)
    : null;
  const images = Array.isArray(b.images)
    ? b.images.filter(str).map((v) => v.trim()).filter(Boolean)
    : null;
  const pdfs = Array.isArray(b.pdfs)
    ? (b.pdfs as unknown[])
        .map((p): ProductPdf | null => {
          if (typeof p !== "object" || p === null) return null;
          const { title, url } = p as Record<string, unknown>;
          if (!str(title) || !str(url) || !url.trim()) return null;
          return { title: title.trim(), url: url.trim() };
        })
        .filter((p): p is ProductPdf => p !== null)
    : null;
  if (!variants || !images || !pdfs) return null;

  const extra =
    typeof b.extra === "object" && b.extra !== null && !Array.isArray(b.extra)
      ? (b.extra as Record<string, unknown>)
      : {};

  return {
    id: "",
    url: b.url.trim(),
    title: b.title.trim(),
    category: b.category.trim(),
    variants,
    images,
    pdfs,
    text: b.text.trim(),
    extra,
  };
}

function parseCatalogProduct(body: unknown): CatalogProduct | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as CatalogProduct;
  if (!str(b.product_id) || !str(b.group_id)) return null;
  if (typeof b.attributes !== "object" || b.attributes === null) return null;
  return b;
}

async function datasetFromRequest(req: NextRequest): Promise<{
  file: string;
  name: string;
} | null> {
  const name = req.nextUrl.searchParams.get("db") ?? DEFAULT_DATASET;
  const file = await resolveDataset(name);
  return file ? { file, name } : null;
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/products/[id]">,
) {
  const ds = await datasetFromRequest(req);
  if (!ds) {
    return Response.json({ error: "Неизвестная база" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const key = decodeURIComponent(id);

  if (usesCatalogCrud(ds.name)) {
    const product = await getCatalogProduct(ds.file, key);
    if (!product) {
      return Response.json({ error: "Продукт не найден" }, { status: 404 });
    }
    return Response.json(product);
  }

  const product = await getProduct(ds.file, key);
  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 });
  }
  return Response.json(product);
}

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/products/[id]">,
) {
  const ds = await datasetFromRequest(req);
  if (!ds) {
    return Response.json({ error: "Неизвестная база" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const key = decodeURIComponent(id);
  const body = await req.json();

  if (usesCatalogCrud(ds.name)) {
    const product = parseCatalogProduct(body);
    if (!product) {
      return Response.json({ error: "Некорректные данные" }, { status: 400 });
    }
    const updated = await updateCatalogProduct(ds.file, key, product);
    if (!updated) {
      return Response.json({ error: "Продукт не найден" }, { status: 404 });
    }
    return Response.json(updated);
  }

  const product = parseAiProduct(body);
  if (!product) {
    return Response.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const updated = await updateProduct(ds.file, key, product);
  if (!updated) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 });
  }
  return Response.json(updated);
}

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/products/[id]">,
) {
  const ds = await datasetFromRequest(req);
  if (!ds) {
    return Response.json({ error: "Неизвестная база" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const key = decodeURIComponent(id);

  const ok = usesCatalogCrud(ds.name)
    ? await deleteCatalogProduct(ds.file, key)
    : await deleteProduct(ds.file, key);

  if (!ok) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
