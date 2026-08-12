/**
 * Universal ≤500 m² assortment — design_selection, compatibility,
 * data_readiness, performance_tables (RegnerWerk_universal.json).
 */
import { cardTitle, loc } from "./catalog";
import type { CatalogProduct } from "./types";

export const ROLE_LABELS_RU: Record<string, string> = {
  water_emitter: "Излучатель",
  water_emitter_assembly: "Сборка излучателя",
  emitter_host: "Корпус под форсунку",
  replaceable_nozzle_set: "Набор форсунок",
  linear_drip_emitter: "Капельная линия",
  distribution_pipe: "Труба",
  hydraulic_connector: "Фитинг",
  hydraulic_control: "Гидравл. контроль",
  hydraulic_conditioning: "Фильтр / PRV",
  electrical_control: "Контроллер",
  electrical_connection: "Электрика",
  sensor: "Датчик",
  enclosure: "Бокс",
  installation_accessory: "Монтаж",
  service_tool: "Инструмент",
};

/** Preferred display order of design roles in the sidebar. */
export const ROLE_ORDER = [
  "water_emitter",
  "water_emitter_assembly",
  "emitter_host",
  "replaceable_nozzle_set",
  "linear_drip_emitter",
  "distribution_pipe",
  "hydraulic_connector",
  "hydraulic_control",
  "hydraulic_conditioning",
  "electrical_control",
  "electrical_connection",
  "sensor",
  "enclosure",
  "installation_accessory",
  "service_tool",
];

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS_RU[role] ?? role;
}

export type AssortmentListItem = {
  product_id: string;
  title: string;
  brand: string;
  model: string;
  article: string;
  group_id: string;
  subtype_id: string;
  role: string;
  configMode: string;
  summaryRu: string;
  layoutEligible: boolean;
  optionsCount: number;
  tablesCount: number;
  connectionsCount: number;
  connectionStatus: string;
  autoLayoutStatus: string;
  needsReview: boolean;
  calculationReady: boolean;
  image: string | null;
  blockers: string[];
  compatStatus: string;
  compatConfirmed: number;
  compatConditional: number;
  compatIncompatible: number;
  portMatchCount: number;
  priceEur: number | null;
  priceText: string;
  threadStandards: string[];
  hasConnectionNote: boolean;
  variantCount: number;
};

/** Compact peer for resolving compatibility IDs in the UI. */
export type AssortmentPeer = {
  product_id: string;
  title: string;
  role: string;
  group_id: string;
  article: string;
  image: string | null;
};

export type CompatPortMatch = {
  local_port_id: string;
  target_product_id: string;
  target_port_id: string;
  domain: string;
  relation_type: string;
  status: string;
  directness: string;
  reason_code: string;
  requirements: string[];
};

export type CompatFunctionalRelation = {
  target_product_id: string;
  relation_type: string;
  status: string;
  reason_code: string;
  inverse: boolean;
  requirements: string[];
};

export type CompatRequirement = {
  rule_id: string;
  domain: string;
  severity: string;
  text_ru: string;
  machine_condition: string;
};

export type CompatibilityView = {
  status: string;
  selectionPolicy: string;
  compatibleIds: string[];
  conditionalIds: string[];
  directIds: string[];
  functionalIds: string[];
  incompatibleIds: string[];
  compatibleGroupIds: string[];
  portMatches: CompatPortMatch[];
  functionalRelations: CompatFunctionalRelation[];
  requirements: CompatRequirement[];
};

export const COMPAT_STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  ready_confirmed: "Ready (confirmed)",
  ready_with_conditional_extensions: "Ready + conditional",
  conditional_only: "Только conditional",
  functional_only_confirmed: "Только functional",
  blocked_missing_ports: "Нет портов",
};

export function compatStatusLabel(status: string): string {
  if (!status) return "—";
  return COMPAT_STATUS_LABELS[status] ?? status;
}

export function compatStatusShort(status: string): string {
  switch (status) {
    case "ready":
    case "ready_confirmed":
      return "compat ✓";
    case "ready_with_conditional_extensions":
      return "compat ~";
    case "conditional_only":
      return "cond only";
    case "functional_only_confirmed":
      return "func only";
    case "blocked_missing_ports":
      return "no ports";
    default:
      return status || "—";
  }
}

export function isCompatReady(status: string): boolean {
  return status === "ready" || status.startsWith("ready");
}

export type AssortmentAudit = {
  productsTotal: number;
  layoutEligible: number;
  configurable: number;
  optionsTotal: number;
  connectionConfirmed: number;
  connectionPartial: number;
  calculationReady: number;
  needsReview: number;
  compatReady: number;
  compatConditional: number;
  confirmedPortPairs: number;
  conditionalPortPairs: number;
  functionalPairs: number;
  bomReady: boolean;
  bomBlocker: string;
  scope: string[];
  unresolved: string[];
};

export function parseAssortmentAudit(
  raw: Record<string, unknown>,
): AssortmentAudit {
  const audit = (raw.catalog_audit ?? {}) as Record<string, unknown>;
  const stats = (audit.statistics ?? {}) as Record<string, unknown>;
  const auto = (audit.automation_readiness ?? {}) as Record<string, unknown>;
  return {
    productsTotal: Number(stats.products_total ?? 0),
    layoutEligible: Number(auto.automatic_layout_eligible_products ?? 0),
    configurable: Number(
      auto.configurable_products_with_internal_options ?? 0,
    ),
    optionsTotal: Number(auto.total_internal_configuration_options ?? 0),
    connectionConfirmed: Number(stats.connection_confirmed ?? 0),
    connectionPartial: Number(stats.connection_partial ?? 0),
    calculationReady: Number(stats.calculation_ready_true ?? 0),
    needsReview: Number(stats.needs_review_true ?? 0),
    compatReady: Number(stats.compatibility_ready_or_functional ?? 0),
    compatConditional: Number(stats.compatibility_conditional_only ?? 0),
    confirmedPortPairs: Number(stats.confirmed_port_relation_pairs ?? 0),
    conditionalPortPairs: Number(stats.conditional_port_relation_pairs ?? 0),
    functionalPairs: Number(stats.functional_relation_pairs ?? 0),
    bomReady: Boolean(auto.automatic_bom_ready),
    bomBlocker: String(auto.automatic_bom_blocker ?? ""),
    scope: Array.isArray(audit.scope) ? (audit.scope as string[]) : [],
    unresolved: Array.isArray(audit.unresolved_issues)
      ? (audit.unresolved_issues as string[])
      : [],
  };
}

export function isAssortmentRecord(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.product_id === "string" &&
    typeof raw.design_selection === "object" &&
    raw.design_selection !== null
  );
}

export function fileLooksAssortment(raw: Record<string, unknown>): boolean {
  if (raw.configuration_schema || raw.catalog_audit) return true;
  const products = raw.products;
  if (!Array.isArray(products) || products.length === 0) return false;
  return isAssortmentRecord(products[0] as Record<string, unknown>);
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function stringIds(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
}

export function toAssortmentListItem(
  raw: Record<string, unknown>,
): AssortmentListItem {
  const p = raw as CatalogProduct;
  const ds = asRecord(raw.design_selection);
  const readiness = asRecord(raw.data_readiness);
  const quality = asRecord(raw.quality);
  const options = Array.isArray(ds.configuration_options)
    ? ds.configuration_options
    : [];
  const tables = Array.isArray(raw.performance_tables)
    ? raw.performance_tables
    : [];
  const connections = Array.isArray(raw.connections) ? raw.connections : [];
  const compat = asRecord(raw.compatibility);
  const blockers = [
    ...(Array.isArray(ds.selection_blockers)
      ? (ds.selection_blockers as string[])
      : []),
    ...(Array.isArray(readiness.blockers)
      ? (readiness.blockers as string[])
      : []),
  ];

  const threadStandards = [
    ...new Set(
      connections
        .map((c) => {
          const o = asRecord(c);
          const ts = o.thread_standard;
          return typeof ts === "string" &&
            ts &&
            ts !== "not_applicable" &&
            ts !== "source_not_specified"
            ? ts
            : null;
        })
        .filter((x): x is string => Boolean(x)),
    ),
  ];

  const priceRaw = raw.price_eur;
  const priceEur =
    typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : null;

  const source = asRecord(raw.source);
  const shopSiblings = Array.isArray(source.sibling_variants)
    ? source.sibling_variants.length
    : 0;
  const shopTotal =
    typeof source.sibling_variants_total === "number"
      ? source.sibling_variants_total
      : shopSiblings;
  const related = Array.isArray(source.assortment_related)
    ? source.assortment_related.length
    : 0;

  return {
    product_id: String(raw.product_id ?? ""),
    title: cardTitle(p, 48),
    brand: String(p.brand || p.manufacturer || ""),
    model: String(p.model || ""),
    article: String(p.article || ""),
    group_id: String(p.group_id || ""),
    subtype_id: String(p.subtype_id || ""),
    role: String(ds.component_role || "unknown"),
    configMode: String(ds.configuration_mode || ""),
    summaryRu: String(ds.selection_summary_ru || ""),
    layoutEligible: Boolean(ds.automatic_layout_eligible),
    optionsCount: options.length,
    tablesCount: tables.length,
    connectionsCount: connections.length,
    connectionStatus: String(readiness.connection_status || ""),
    autoLayoutStatus: String(readiness.automatic_layout_status || ""),
    needsReview: Boolean(quality.needs_review),
    calculationReady: Boolean(quality.calculation_ready),
    image: p.media?.images?.[0] ?? null,
    blockers,
    compatStatus: String(compat.status || ""),
    compatConfirmed: stringIds(compat.compatible_product_ids).length,
    compatConditional: stringIds(compat.conditional_product_ids).length,
    compatIncompatible: stringIds(compat.incompatible_product_ids).length,
    portMatchCount: Array.isArray(compat.port_matches)
      ? compat.port_matches.length
      : 0,
    priceEur,
    priceText: typeof raw.price_text === "string" ? raw.price_text : "",
    threadStandards,
    hasConnectionNote:
      typeof raw.connection_note === "string" &&
      raw.connection_note.trim().length > 0,
    variantCount: shopTotal + related,
  };
}

export function toAssortmentPeer(raw: Record<string, unknown>): AssortmentPeer {
  const item = toAssortmentListItem(raw);
  return {
    product_id: item.product_id,
    title: item.title,
    role: item.role,
    group_id: item.group_id,
    article: item.article,
    image: item.image,
  };
}

export function parseCompatibility(raw: unknown): CompatibilityView {
  const c = asRecord(raw);
  const portMatches: CompatPortMatch[] = Array.isArray(c.port_matches)
    ? c.port_matches.map((m) => {
        const o = asRecord(m);
        return {
          local_port_id: String(o.local_port_id ?? ""),
          target_product_id: String(o.target_product_id ?? ""),
          target_port_id: String(o.target_port_id ?? ""),
          domain: String(o.domain ?? ""),
          relation_type: String(o.relation_type ?? ""),
          status: String(o.status ?? ""),
          directness: String(o.directness ?? ""),
          reason_code: String(o.reason_code ?? ""),
          requirements: stringIds(o.requirements),
        };
      })
    : [];
  const functionalRelations: CompatFunctionalRelation[] = Array.isArray(
    c.functional_relations,
  )
    ? c.functional_relations.map((m) => {
        const o = asRecord(m);
        return {
          target_product_id: String(o.target_product_id ?? ""),
          relation_type: String(o.relation_type ?? ""),
          status: String(o.status ?? ""),
          reason_code: String(o.reason_code ?? ""),
          inverse: Boolean(o.inverse),
          requirements: stringIds(o.requirements),
        };
      })
    : [];
  const requirements: CompatRequirement[] = Array.isArray(c.requirements)
    ? c.requirements.map((m) => {
        const o = asRecord(m);
        return {
          rule_id: String(o.rule_id ?? ""),
          domain: String(o.domain ?? ""),
          severity: String(o.severity ?? ""),
          text_ru: String(o.text_ru ?? o.text ?? ""),
          machine_condition: String(o.machine_condition ?? ""),
        };
      })
    : [];

  return {
    status: String(c.status || ""),
    selectionPolicy: String(c.selection_policy || ""),
    compatibleIds: stringIds(c.compatible_product_ids),
    conditionalIds: stringIds(c.conditional_product_ids),
    directIds: stringIds(c.direct_product_ids),
    functionalIds: stringIds(c.functional_product_ids),
    incompatibleIds: stringIds(c.incompatible_product_ids),
    compatibleGroupIds: stringIds(c.compatible_group_ids),
    portMatches,
    functionalRelations,
    requirements,
  };
}

export type RoleNavItem = {
  role: string;
  label: string;
  count: number;
  eligible: number;
  review: number;
};

export function buildRoleNav(items: AssortmentListItem[]): RoleNavItem[] {
  const map = new Map<string, RoleNavItem>();
  for (const i of items) {
    const cur = map.get(i.role) ?? {
      role: i.role,
      label: roleLabel(i.role),
      count: 0,
      eligible: 0,
      review: 0,
    };
    cur.count += 1;
    if (i.layoutEligible) cur.eligible += 1;
    if (i.needsReview) cur.review += 1;
    map.set(i.role, cur);
  }
  const ordered = ROLE_ORDER.filter((r) => map.has(r)).map((r) => map.get(r)!);
  const rest = [...map.values()]
    .filter((x) => !ROLE_ORDER.includes(x.role))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  return [...ordered, ...rest];
}

export function assortmentDisplayName(raw: Record<string, unknown>): string {
  const p = raw as CatalogProduct;
  const brand = (p.brand || p.manufacturer || "").trim();
  const model = (p.model || "").trim();
  if (brand && model) return `${brand} ${model}`;
  if (model) return model;
  const de = loc(p.name, "de");
  if (de) return de;
  return p.product_id;
}

export function formatPriceEur(
  priceEur: number | null | undefined,
  priceText?: string | null,
): string {
  if (typeof priceEur === "number" && Number.isFinite(priceEur)) {
    return `${priceEur.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €`;
  }
  if (priceText && priceText.trim()) return priceText.trim();
  return "";
}
