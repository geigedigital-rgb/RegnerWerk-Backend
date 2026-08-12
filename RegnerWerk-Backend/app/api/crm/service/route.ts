import { NextRequest, NextResponse } from "next/server";
import { createServiceCase, listServiceCases } from "@/lib/crm/service";
import type { Priority, ServiceCaseType } from "@/lib/crm/types";
import { requireApiUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireApiUser("crm.customer.read");
  if (gate.error) return gate.error;
  try {
    const openOnly = req.nextUrl.searchParams.get("open") !== "0";
    const cases = await listServiceCases({ openOnly });
    return NextResponse.json({ cases });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireApiUser("crm.service.write");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      contact_id?: string;
      problem_description?: string;
      title?: string;
      type?: ServiceCaseType;
      urgency?: Priority;
      next_action?: string;
    };
    if (!body.problem_description?.trim()) {
      return NextResponse.json(
        { error: "problem_description erforderlich" },
        { status: 400 },
      );
    }
    const serviceCase = await createServiceCase({
      contact_id: body.contact_id,
      problem_description: body.problem_description,
      title: body.title,
      type: body.type,
      urgency: body.urgency,
      next_action: body.next_action,
    });
    return NextResponse.json({ serviceCase }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
