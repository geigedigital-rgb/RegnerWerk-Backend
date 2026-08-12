import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { updatePhoneCall, getPhoneCall } from "@/lib/ai/calls";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createTask, addTimelineEvent } from "@/lib/crm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Operator actions on a live/historical call (Stage 5 — no recording control yet).
 * actions: mark_urgent | request_transfer | create_callback | set_outcome
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireApiUser("calls.read");
  if (gate.error) return gate.error;

  try {
    const { id } = await ctx.params;
    const detail = await getPhoneCall(id);
    if (!detail) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    const body = (await req.json()) as {
      action?: string;
      reason?: string;
      outcome?: string;
      summary?: string;
    };

    const call = detail.call;
    const sb = getSupabaseAdmin();

    if (body.action === "mark_urgent") {
      const updated = await updatePhoneCall(id, { urgency: "urgent" });
      await sb.from("call_events").insert({
        call_id: id,
        event_type: "operator.mark_urgent",
        sequence: detail.events.length + 1,
        payload_redacted: { by: gate.user!.id },
      });
      return NextResponse.json({ call: updated });
    }

    if (body.action === "request_transfer") {
      const updated = await updatePhoneCall(id, { status: "transferring" });
      await sb.from("call_events").insert({
        call_id: id,
        event_type: "operator.request_transfer",
        sequence: detail.events.length + 1,
        payload_redacted: {
          by: gate.user!.id,
          reason: body.reason ?? "human_request",
        },
      });
      if (call.contact_id) {
        await createTask({
          title: `Transfer / Rückruf — ${call.from_number_e164 ?? "Anruf"}`,
          description: body.reason ?? "Operator hat Transfer angefordert",
          type: "callback",
          priority: "high",
          related_contact_id: call.contact_id,
        });
      }
      return NextResponse.json({ call: updated });
    }

    if (body.action === "create_callback") {
      const task = await createTask({
        title: `Rückruf nach Anruf`,
        description:
          body.summary ||
          `Callback für ${call.from_number_e164 ?? "unbekannt"}`,
        type: "callback",
        priority: call.urgency === "urgent" ? "urgent" : "normal",
        related_contact_id: call.contact_id ?? undefined,
      });
      await sb.from("call_events").insert({
        call_id: id,
        event_type: "operator.create_callback",
        sequence: detail.events.length + 1,
        payload_redacted: { taskId: task.id, by: gate.user!.id },
      });
      if (call.contact_id) {
        await addTimelineEvent({
          contact_id: call.contact_id,
          type: "task",
          title: "Rückruf aus Anruf",
          summary: task.title,
          actor_type: "employee",
          source: "operator",
          payload: { call_id: id, task_id: task.id },
        });
      }
      return NextResponse.json({ call, task });
    }

    if (body.action === "set_outcome") {
      if (!body.outcome) {
        return NextResponse.json({ error: "outcome erforderlich" }, { status: 400 });
      }
      const updated = await updatePhoneCall(id, {
        outcome: body.outcome,
        summary: body.summary,
        status: "completed",
      });
      return NextResponse.json({ call: updated });
    }

    return NextResponse.json({ error: "Unbekannte action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
