import { z } from "zod";

const lngLat = z.object({
  lng: z.number().finite(),
  lat: z.number().finite(),
});

const drawnZone = z.object({
  id: z.string().min(1).max(128),
  type: z.string().min(1).max(64),
  coordinates: z.array(lngLat).min(3).max(500),
});

const plotFixture = z
  .object({
    id: z.string().min(1).max(128),
    kind: z.string().min(1).max(64),
    position: lngLat,
  })
  .passthrough();

const geocodeFeature = z
  .object({
    id: z.string().min(1).max(256),
    place_name: z.string().max(512).optional(),
    text: z.string().max(256).optional(),
    center: z.tuple([z.number(), z.number()]).optional(),
  })
  .passthrough();

const sprinklerHead = z
  .object({
    id: z.string(),
    position: lngLat,
    kind: z.string(),
    configKey: z.string(),
    radiusM: z.number(),
    arcDeg: z.number(),
    rotationDeg: z.number(),
    flowLMin: z.number(),
    lawnZoneId: z.string(),
    hydraulicZone: z.number(),
  })
  .passthrough();

const bomLine = z
  .object({
    key: z.string(),
    article: z.string().nullable(),
    label: z.string(),
    qty: z.number(),
    unit: z.enum(["piece", "meter", "roll"]),
    priceEur: z.number().nullable(),
    totalEur: z.number().nullable(),
    group: z.string(),
  })
  .passthrough();

const sofortPlan = z
  .object({
    version: z.literal(1),
    createdAt: z.string(),
    heads: z.array(sprinklerHead).max(500),
    pipes: z.array(z.record(z.string(), z.unknown())).max(500),
    zones: z.array(z.record(z.string(), z.unknown())).max(100),
    bom: z.array(bomLine).max(500),
    totalKnownEur: z.number(),
    hasUnknownPrices: z.boolean(),
    warnings: z.array(z.string()).max(200),
    assumptions: z.array(z.string()).max(200),
    sourceFlowLMin: z.number(),
    lawnAreaM2: z.number(),
    dripAreaM2: z.number(),
    coveragePct: z.number(),
  })
  .passthrough();

export const projectPayloadSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().optional(),
  place: geocodeFeature,
  zones: z.array(drawnZone).max(100),
  fixtures: z.array(plotFixture).max(50),
  sofortPlan: sofortPlan,
  plotStage: z.enum(["zones", "technik", "ergebnis"]).optional(),
});

export const submitBodySchema = z.object({
  payload: projectPayloadSchema,
  customerEmail: z
    .union([z.literal(""), z.string().trim().email().max(254)])
    .optional(),
  customerName: z
    .union([z.literal(""), z.string().trim().max(120)])
    .optional(),
  /** Re-submit updates this id when present. */
  projectId: z.string().uuid().optional(),
});

export const pdfBodySchema = z.object({
  payload: projectPayloadSchema,
  projectId: z.string().uuid().optional(),
  customerEmail: z
    .union([z.literal(""), z.string().trim().email().max(254)])
    .optional(),
  customerName: z
    .union([z.literal(""), z.string().trim().max(120)])
    .optional(),
  /** Persist as draft when generating PDF from configurator. */
  persist: z.boolean().optional().default(true),
});

export type ProjectPayload = z.infer<typeof projectPayloadSchema>;
export type SubmitBody = z.infer<typeof submitBodySchema>;

export function placeLabelFromPayload(payload: ProjectPayload): string {
  const p = payload.place as Record<string, unknown>;
  const name =
    (typeof p.placeName === "string" && p.placeName) ||
    (typeof p.place_name === "string" && p.place_name) ||
    (typeof p.address === "string" && p.address) ||
    (typeof p.text === "string" && p.text) ||
    payload.place.id;
  return String(name).slice(0, 512);
}

export function sanitizeOptionalText(v: string | undefined | null): string | null {
  if (!v) return null;
  const cleaned = v.replace(/[<>]/g, "").trim();
  return cleaned.length ? cleaned : null;
}
