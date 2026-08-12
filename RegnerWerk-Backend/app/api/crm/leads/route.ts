import { NextResponse } from "next/server";
import { listLeads } from "@/lib/crm";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const leads = await listLeads();
    return NextResponse.json({ leads });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
