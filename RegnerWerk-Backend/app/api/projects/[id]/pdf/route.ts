import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, jsonError, withCors } from "@/lib/cors";
import { getPdfBytes } from "@/lib/projects";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const bytes = await getPdfBytes(id);
    if (!bytes) return jsonError(req, 404, "Not found");
    return withCors(
      req,
      new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="RegnerWerk-${id.slice(0, 8)}.pdf"`,
        },
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF failed";
    return jsonError(req, 500, msg);
  }
}
