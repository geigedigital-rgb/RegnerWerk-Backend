import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, jsonError, withCors } from "@/lib/cors";
import { listProjects } from "@/lib/projects";

export const runtime = "nodejs";

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  try {
    const items = await listProjects();
    return withCors(req, NextResponse.json({ projects: items }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "List failed";
    console.error("[projects]", msg);
    return jsonError(req, 500, msg);
  }
}
