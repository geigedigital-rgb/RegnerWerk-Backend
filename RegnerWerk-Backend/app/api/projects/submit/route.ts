import { NextRequest, NextResponse } from "next/server";
import {
  checkSubmitToken,
  corsPreflight,
  jsonError,
  withCors,
} from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { submitBodySchema } from "@/lib/project-schema";
import { upsertProject } from "@/lib/projects";

export const runtime = "nodejs";

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  if (!checkSubmitToken(req)) {
    return jsonError(req, 401, "Unauthorized");
  }

  const rl = rateLimit(`submit:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) return jsonError(req, 429, "Too many requests");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, 400, "Invalid JSON");
  }

  const parsed = submitBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(req, 400, "Validation failed", {
      details: parsed.error.flatten(),
    });
  }

  const { payload, customerEmail, customerName, projectId } = parsed.data;

  try {
    const project = await upsertProject({
      payload,
      status: "submitted",
      customerEmail: customerEmail || null,
      customerName: customerName || null,
      projectId,
      withPdf: true,
    });

    return withCors(
      req,
      NextResponse.json({
        id: project.id,
        status: project.status,
        pdfPath: project.pdf_path,
        updatedAt: project.updated_at,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    console.error("[projects/submit]", msg);
    return jsonError(req, 500, msg);
  }
}
