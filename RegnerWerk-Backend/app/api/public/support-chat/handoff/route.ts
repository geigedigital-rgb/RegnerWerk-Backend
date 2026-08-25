import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { corsPreflight, jsonError, withCors } from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { processPublicLead } from "@/lib/crm/process-public-lead";
import { formatTranscript, supportChatMessageSchema } from "@/lib/ai/support-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handoffSchema = z
  .object({
    submission_id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(60).optional().nullable(),
    email: z.string().trim().email().max(200).optional().nullable(),
    postal_code: z.string().trim().max(20).optional().nullable(),
    message: z.string().trim().max(500).optional().nullable(),
    messages: z.array(supportChatMessageSchema).max(24).optional().nullable(),
    landing_page: z.string().trim().max(500).optional().nullable(),
    referrer: z.string().trim().max(500).optional().nullable(),
    privacy_accepted: z.literal(true),
    company_website: z.string().max(200).optional().nullable(),
  })
  .refine((v) => Boolean(v.phone?.trim() || v.email?.trim()), {
    message: "Telefon oder E-Mail erforderlich",
  });

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/**
 * POST /api/public/support-chat/handoff
 * Captures chat transcript + contact → CRM inbox/lead as support_chat.
 */
export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const rl = rateLimit(`public-support-handoff:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) {
    return jsonError(req, 429, "Too many requests", { request_id: requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, 400, "Invalid JSON", { request_id: requestId });
  }

  const parsed = handoffSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(req, 400, "Validation failed", {
      request_id: requestId,
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;
  const transcript = data.messages?.length
    ? formatTranscript(data.messages)
    : "";
  const note = data.message?.trim();
  const combined = [
    "Support-Chat Anfrage",
    note ? `Hinweis: ${note}` : null,
    transcript ? `\n--- Chat ---\n${transcript}` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  try {
    const result = await processPublicLead({
      input: {
        submission_id: data.submission_id ?? randomUUID(),
        form_type: "support_chat",
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        postal_code: data.postal_code || null,
        message: combined,
        callback_requested: true,
        callback_consent: true,
        privacy_notice_version: "2026-08-01",
        landing_page: data.landing_page || "/support-chat",
        referrer: data.referrer || null,
        company_website: data.company_website || null,
      },
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return withCors(
      req,
      NextResponse.json(
        {
          accepted: true as const,
          reference: result.reference,
          request_id: requestId,
        },
        { status: 200 },
      ),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Handoff failed";
    console.error("[public/support-chat/handoff]", requestId, msg);
    return jsonError(req, 500, "Processing failed", { request_id: requestId });
  }
}
