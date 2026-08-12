import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, jsonError, withCors } from "@/lib/cors";
import { deleteProject, getProject } from "@/lib/projects";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const project = await getProject(id);
    if (!project) return jsonError(req, 404, "Not found");
    return withCors(req, NextResponse.json({ project }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return jsonError(req, 500, msg);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await deleteProject(id);
    return withCors(req, NextResponse.json({ ok: true }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return jsonError(req, 500, msg);
  }
}
