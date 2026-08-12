import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, jsonError, withCors } from "@/lib/cors";
import { duplicateProject, frontendOpenUrl } from "@/lib/projects";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const project = await duplicateProject(id);
    return withCors(
      req,
      NextResponse.json({
        id: project.id,
        openUrl: frontendOpenUrl(project.id),
        project,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Duplicate failed";
    return jsonError(req, 500, msg);
  }
}
