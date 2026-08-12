import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { listPhoneCalls, updatePhoneCall } from "@/lib/ai/calls";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireApiUser("calls.read");
  if (gate.error) return gate.error;
  try {
    const live = req.nextUrl.searchParams.get("live") === "1";
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const calls = await listPhoneCalls({
      liveOnly: live,
      status: live ? undefined : status,
      limit: live ? 20 : 80,
    });
    return NextResponse.json({ calls });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireApiUser("calls.read");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      id?: string;
      summary?: string;
      outcome?: string;
      review_status?: string;
      urgency?: string;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
    }
    const call = await updatePhoneCall(body.id, {
      summary: body.summary,
      outcome: body.outcome,
      review_status: body.review_status,
      urgency: body.urgency,
    });
    return NextResponse.json({ call });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
