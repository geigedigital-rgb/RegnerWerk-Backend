import path from "node:path";

/** Root of RegnerWerk data/ (sibling of this backend repo). */
export const DATA_ROOT = process.env.PRODUCTS_DIR
  ? path.resolve(process.env.PRODUCTS_DIR)
  : path.resolve(process.cwd(), "../../RegnerWerk/data");

export const DEFAULT_DATASET =
  "catalog/normalized/RegnerWerk_universal.json";
