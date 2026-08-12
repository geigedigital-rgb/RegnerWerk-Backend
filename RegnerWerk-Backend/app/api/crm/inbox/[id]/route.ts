import { NextRequest, NextResponse } from "next/server";
import {
  acceptInboxAsLead,
  getInboxItem,
  markInboxSpam,
  rejectInboxItem,
} from "@/lib/crm";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const item = await getInboxItem(id);
    if (!item) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("crm.inbox.triage");
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      action?: "accept" | "reject" | "spam";
      reason?: string;
    };

    if (body.action === "accept") {
      const result = await acceptInboxAsLead(id);
      return NextResponse.json(result);
    }
    if (body.action === "reject") {
      if (!body.reason?.trim()) {
        return NextResponse.json(
          { error: "reason erforderlich" },
          { status: 400 },
        );
      }
      const item = await rejectInboxItem(id, body.reason);
      return NextResponse.json({ item });
    }
    if (body.action === "spam") {
      const item = await markInboxSpam(id);
      return NextResponse.json({ item });
    }
    return NextResponse.json({ error: "Unbekannte action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
