import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type GatewayHealth = {
  status: string;
  activeCalls?: number;
  version?: string;
};

export async function GET() {
  const base = (
    process.env.VOICE_GATEWAY_URL || "http://localhost:8000"
  ).replace(/\/$/, "");

  try {
    const res = await fetch(`${base}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      return NextResponse.json(
        { status: "error", activeCalls: 0 },
        { status: 502 },
      );
    }
    const data = (await res.json()) as GatewayHealth;
    return NextResponse.json({
      status: data.status === "ok" ? "ok" : "error",
      activeCalls: data.activeCalls ?? 0,
      version: data.version ?? "unknown",
    });
  } catch {
    return NextResponse.json(
      { status: "offline", activeCalls: 0 },
      { status: 503 },
    );
  }
}
