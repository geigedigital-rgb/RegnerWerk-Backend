import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  corsPreflight,
  jsonError,
  withCors,
} from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { publicLeadSchema } from "@/lib/crm/public-leads";
import { processPublicLead } from "@/lib/crm/process-public-lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/**
 * POST /api/public/leads
 * Website → Inbox (TZ §30.2). Response never reveals existing customers.
 */
export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const rl = rateLimit(`public-leads:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return jsonError(req, 429, "Too many requests", { request_id: requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, 400, "Invalid JSON", { request_id: requestId });
  }

  const parsed = publicLeadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(req, 400, "Validation failed", {
      request_id: requestId,
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await processPublicLead({
      input: parsed.data,
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
    const msg = e instanceof Error ? e.message : "Processing failed";
    console.error("[public/leads]", requestId, msg);
    return jsonError(req, 500, "Processing failed", { request_id: requestId });
  }
}
