/** Human labels for catalog datasets (client-safe, no fs). */

export const DATASET_LABELS: Record<string, string> = {
  "catalog/normalized/RegnerWerk_universal.json": "Universal ≤500 м²",
  "catalog/normalized/products_assortment_500m2.json":
    "Ассортимент ≤500 м² (стар.)",
  "catalog/normalized/products_normalized.json": "Каталог (полный)",
  "catalog/normalized/products_needs_review.json": "На проверку",
  "catalog/normalized/products_unclassified.json": "Без группы",
  "catalog/normalized/products_universal_up_to_500m2.json":
    "Универсальный ≤500 м² (стар.)",
};

export function datasetLabel(name: string): string {
  return (
    DATASET_LABELS[name] ??
    name
      .replace(/^catalog\/normalized\//, "")
      .replace(/^raw\//, "raw/")
  );
}
