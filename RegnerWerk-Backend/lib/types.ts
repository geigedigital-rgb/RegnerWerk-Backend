/**
 * Types for RegnerWerk catalog admin.
 *
 * Two product shapes coexist:
 *  - CatalogProduct — data/catalog/normalized/* (sections → groups → attrs)
 *  - AiProduct — data/raw/products-ai*.json (legacy scrape / AI input)
 */

export type Localized = { de?: string; ru?: string; [lang: string]: string | undefined };

export type FieldStatus = "confirmed" | "inferred" | "not_found" | "needs_review" | string;

export type ProductQuality = {
  classification_confidence?: number;
  extraction_confidence?: number;
  calculation_ready?: boolean;
  needs_review?: boolean;
  warnings?: string[];
};

export type ProductPdf = { title: string; url: string };

export type CatalogConnection = {
  port_id?: string;
  role?: string;
  connection_type?: string;
  nominal_size_mm?: number | null;
  thread_size_inch?: string | null;
  thread_gender?: string | null;
  thread_standard?: string | null;
  [key: string]: unknown;
};

export type CatalogProduct = {
  product_id: string;
  parent_product_id?: string | null;
  article?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
  series?: string | null;
  model?: string | null;
  name: Localized | string;
  group_id: string;
  subtype_id?: string | null;
  unit?: string | null;
  package_quantity?: number | null;
  lifecycle_status?: string | null;
  attributes: Record<string, unknown>;
  connections: CatalogConnection[];
  performance_tables: unknown[];
  compatibility?: Record<string, unknown>;
  bom?: unknown[];
  media?: {
    images?: string[];
    documents?: ProductPdf[];
  };
  source?: {
    source_record_id?: string;
    source_name?: string;
    source_url?: string;
    source_category?: string;
    source_title?: string;
    source_variant?: string | null;
    sibling_articles?: string[];
    sibling_variants?: Array<{
      article?: string | null;
      variant?: string | null;
      price_eur?: number | null;
      product_id?: string | null;
      in_assortment?: boolean;
      role?: string | null;
      image_url?: string | null;
      image_url_secondary?: string | null;
    }>;
    sibling_variants_preview?: Array<{
      article?: string | null;
      variant?: string | null;
      price_eur?: number | null;
      product_id?: string | null;
      in_assortment?: boolean;
      image_url?: string | null;
      image_url_secondary?: string | null;
    }>;
    sibling_variants_total?: number;
    sibling_variants_truncated?: boolean;
    assortment_related?: Array<{
      product_id?: string | null;
      article?: string | null;
      variant?: string | null;
      price_eur?: number | null;
      role?: string | null;
      in_assortment?: boolean;
    }>;
    variant_family_url?: string;
  };
  field_status?: Record<string, FieldStatus>;
  quality?: ProductQuality;
  provenance?: unknown;
  [key: string]: unknown;
};

export type AttributeDef = {
  attribute_id: string;
  name: Localized;
  data_type: "string" | "number" | "integer" | "boolean" | "enum" | string;
  unit?: string | null;
  required?: boolean;
  nullable?: boolean;
  multiple?: boolean;
  allowed_values?: string[] | null;
  minimum?: number | null;
  maximum?: number | null;
  calculation_role?: string | null;
  critical_for_calculation?: boolean;
  description?: string;
  example?: unknown;
};

export type GroupSchema = {
  group_id: string;
  section_id: string;
  name: Localized;
  description?: string;
  allowed_subtypes?: string[];
  attributes: AttributeDef[];
};

export type TaxonomySection = {
  section_id: string;
  name: Localized;
  description?: string;
};

export type TaxonomyGroup = {
  group_id: string;
  section_id: string;
  name: Localized;
  subtypes?: { subtype_id: string }[];
};

export type Taxonomy = {
  schema_version?: string;
  generated_at?: string;
  sections: TaxonomySection[];
  groups: TaxonomyGroup[];
};

/** List row for catalog products. */
export type CatalogListItem = {
  product_id: string;
  title: string;
  titleDe: string;
  brand: string;
  model: string;
  article: string;
  group_id: string;
  subtype_id: string;
  image: string | null;
  imageCount: number;
  docCount: number;
  calculationReady: boolean;
  needsReview: boolean;
  warnings: string[];
  confirmedAttrs: number;
  missingCritical: number;
};

/* ---------- Legacy AiProduct (raw scrape) ---------- */

export type AiProduct = {
  id: string;
  url: string;
  title: string;
  category: string;
  variants: string[];
  images: string[];
  pdfs: ProductPdf[];
  text: string;
  extra: Record<string, unknown>;
};

export type ProductListItem = {
  key: string;
  id: string;
  title: string;
  category: string;
  image: string | null;
  imageCount: number;
  pdfCount: number;
  variantCount: number;
  textLength: number;
};

export type DatasetKind = "catalog" | "raw";
