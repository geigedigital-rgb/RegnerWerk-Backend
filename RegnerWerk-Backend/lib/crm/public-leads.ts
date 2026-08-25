import { z } from "zod";

export const publicLeadSchema = z.object({
  submission_id: z.string().uuid(),
  form_type: z.enum([
    "contact",
    "calculator",
    "repair",
    "service",
    "projekt_anfrage",
    "support_chat",
    "other",
  ]),
  request_type: z
    .enum([
      "new_installation",
      "repair",
      "extension",
      "maintenance",
      "winterization",
      "component_purchase",
      "commercial",
      "other",
      "spam",
    ])
    .optional()
    .nullable(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(60).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  area_m2: z.number().positive().max(100_000).optional().nullable(),
  water_source: z.string().trim().max(120).optional().nullable(),
  existing_system: z.boolean().optional().nullable(),
  message: z.string().trim().max(4000).optional().nullable(),
  garden_type: z.string().trim().max(120).optional().nullable(),
  callback_requested: z.boolean().optional().nullable(),
  callback_window: z.string().trim().max(200).optional().nullable(),
  callback_consent: z.boolean().optional().nullable(),
  privacy_notice_version: z.string().trim().max(40).optional().nullable(),
  landing_page: z.string().trim().max(500).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  utm: z.record(z.string(), z.string()).optional().nullable(),
  /** Honeypot — if filled, accept silently without CRM write */
  company_website: z.string().max(200).optional().nullable(),
});

export type PublicLeadInput = z.infer<typeof publicLeadSchema>;

export function inferRequestType(input: {
  request_type?: string | null;
  form_type?: string;
  garden_type?: string | null;
  message?: string | null;
}): PublicLeadInput["request_type"] {
  if (input.request_type) {
    return input.request_type as PublicLeadInput["request_type"];
  }
  const g = (input.garden_type || "").toLowerCase();
  const m = (input.message || "").toLowerCase();
  if (input.form_type === "repair" || /reparatur|rohrbruch|undicht/.test(m)) {
    return "repair";
  }
  if (input.form_type === "support_chat") {
    if (/reparatur|störung|undicht/.test(m)) return "repair";
    if (/wartung|einwinter/.test(m)) {
      return /einwinter/.test(m) ? "winterization" : "maintenance";
    }
    if (/erweiterung|nachrüstung/.test(m)) return "extension";
    return "other";
  }
  if (input.form_type === "service" || /wartung|service|einwinter/.test(g + m)) {
    return /einwinter/.test(g + m) ? "winterization" : "maintenance";
  }
  if (/nachrüstung|erweiterung|bestehend/.test(g + m)) return "extension";
  if (/gewerbe|firma|hotel/.test(m)) return "commercial";
  return "new_installation";
}

export function extractPostalCode(
  postal_code?: string | null,
  addressOrLocation?: string | null,
): string | null {
  const direct = postal_code?.trim();
  if (direct && /^\d{5}/.test(direct)) return direct.slice(0, 5);
  const fromLoc = (addressOrLocation || "").match(/\b(\d{5})\b/);
  return fromLoc?.[1] ?? (direct || null);
}

export function nextReferenceCode(now = new Date()): string {
  const y = now.getFullYear();
  const seq = Math.floor(Math.random() * 900000) + 100000;
  return `RW-${y}-${seq}`;
}
