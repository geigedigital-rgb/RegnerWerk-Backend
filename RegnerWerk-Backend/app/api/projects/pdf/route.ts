import { NextRequest, NextResponse } from "next/server";
import {
  checkSubmitToken,
  corsPreflight,
  jsonError,
  withCors,
} from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { pdfBodySchema } from "@/lib/project-schema";
import { getPdfBytes, upsertProject } from "@/lib/projects";

export const runtime = "nodejs";

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  if (!checkSubmitToken(req)) {
    return jsonError(req, 401, "Unauthorized");
  }

  const rl = rateLimit(`pdf:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return jsonError(req, 429, "Too many requests");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, 400, "Invalid JSON");
  }

  const parsed = pdfBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(req, 400, "Validation failed", {
      details: parsed.error.flatten(),
    });
  }

  const { payload, projectId, customerEmail, customerName, persist } =
    parsed.data;

  try {
    let id = projectId;
    if (persist !== false) {
      const project = await upsertProject({
        payload,
        status: projectId ? "submitted" : "draft",
        customerEmail: customerEmail || null,
        customerName: customerName || null,
        projectId,
        withPdf: true,
      });
      id = project.id;
    }

    if (!id) {
      // Generate without persist
      const { buildProjectPdf } = await import("@/lib/pdf/project-pdf");
      const bytes = await buildProjectPdf(payload, {
        projectId: "local",
        customerName: customerName || null,
        customerEmail: customerEmail || null,
      });
      return withCors(
        req,
        new NextResponse(Buffer.from(bytes), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="RegnerWerk-Plan.pdf"',
            "X-Project-Id": "",
          },
        }),
      );
    }

    const bytes = await getPdfBytes(id);
    if (!bytes) return jsonError(req, 404, "PDF not found");

    return withCors(
      req,
      new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="RegnerWerk-${id.slice(0, 8)}.pdf"`,
          "X-Project-Id": id,
        },
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF failed";
    console.error("[projects/pdf]", msg);
    return jsonError(req, 500, msg);
  }
}
