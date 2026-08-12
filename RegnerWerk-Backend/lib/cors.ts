import { NextRequest, NextResponse } from "next/server";

function allowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? "http://localhost:3000";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(req: NextRequest): HeadersInit {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Projects-Token",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  } else if (!origin && allowed.length === 1) {
    // same-origin / server-side
    headers["Access-Control-Allow-Origin"] = allowed[0];
  }
  return headers;
}

export function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const h = corsHeaders(req);
  for (const [k, v] of Object.entries(h)) {
    res.headers.set(k, v);
  }
  return res;
}

export function corsPreflight(req: NextRequest): NextResponse {
  return withCors(req, new NextResponse(null, { status: 204 }));
}

/** Optional shared token for public write endpoints. */
export function checkSubmitToken(req: NextRequest): boolean {
  const expected = process.env.PROJECTS_SUBMIT_TOKEN?.trim();
  if (!expected) return true;
  const got = req.headers.get("x-projects-token")?.trim();
  return got === expected;
}

export function jsonError(
  req: NextRequest,
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return withCors(
    req,
    NextResponse.json({ error: message, ...extra }, { status }),
  );
}
