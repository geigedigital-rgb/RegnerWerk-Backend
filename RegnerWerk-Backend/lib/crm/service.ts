import { getSupabaseAdmin } from "@/lib/supabase";
import { addTimelineEvent, getLead } from "@/lib/crm";
import type {
  Priority,
  ServiceCase,
  ServiceCaseListItem,
  ServiceCaseStatus,
  ServiceCaseType,
} from "@/lib/crm/types";

function sb() {
  return getSupabaseAdmin();
}

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function caseNumber(now = new Date()): string {
  const y = now.getFullYear();
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `SC-${y}-${n}`;
}

function detectSafetyFlags(text: string): string[] {
  const t = text.toLowerCase();
  const flags: string[] = [];
  if (/rohrbruch|wasserschaden|notfall|überflut|leckage.*stark/.test(t)) {
    flags.push("emergency_water");
  }
  if (/strom|elektro|kurzschluss/.test(t)) flags.push("electrical");
  return flags;
}

export async function listServiceCases(opts?: {
  openOnly?: boolean;
}): Promise<ServiceCaseListItem[]> {
  let q = sb()
    .from("service_cases")
    .select("*, contacts(display_name)")
    .order("updated_at", { ascending: false })
    .limit(150);
  if (opts?.openOnly) {
    q = q.not("status", "in", '("resolved","closed")');
  }
  const { data, error } = await q;
  throwOnError(error);
  return (data ?? []).map((row) => {
    const r = row as ServiceCase & {
      contacts?: { display_name: string } | null;
    };
    const { contacts, ...rest } = r;
    return {
      ...(rest as ServiceCase),
      contact_name: contacts?.display_name ?? null,
    };
  });
}

export async function getServiceCase(id: string): Promise<ServiceCase | null> {
  const { data, error } = await sb()
    .from("service_cases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOnError(error);
  return (data as ServiceCase | null) ?? null;
}

export async function createServiceCase(input: {
  contact_id?: string | null;
  property_id?: string | null;
  source_lead_id?: string | null;
  source_inbox_item_id?: string | null;
  type?: ServiceCaseType;
  urgency?: Priority;
  problem_description: string;
  title?: string;
  next_action?: string;
}): Promise<ServiceCase> {
  const desc = input.problem_description.trim();
  if (!desc) throw new Error("problem_description erforderlich");

  const safety_flags = detectSafetyFlags(desc);
  const urgency: Priority =
    input.urgency ||
    (safety_flags.includes("emergency_water") ? "urgent" : "normal");

  const { data, error } = await sb()
    .from("service_cases")
    .insert({
      contact_id: input.contact_id ?? null,
      property_id: input.property_id ?? null,
      source_lead_id: input.source_lead_id ?? null,
      source_inbox_item_id: input.source_inbox_item_id ?? null,
      type: input.type ?? "repair",
      status: "new",
      urgency,
      problem_description: desc,
      safety_flags,
      case_number: caseNumber(),
      title: input.title?.trim() || desc.slice(0, 80),
      next_action: input.next_action || "Triage / Rückruf",
      next_action_due_at: new Date(
        Date.now() + (urgency === "urgent" ? 2 : 24) * 60 * 60 * 1000,
      ).toISOString(),
    })
    .select("*")
    .single();
  throwOnError(error);
  const serviceCase = data as ServiceCase;

  await addTimelineEvent({
    type: "service_case_created",
    title: urgency === "urgent" ? "Dringender Servicefall" : "Servicefall erstellt",
    summary: `${serviceCase.case_number} · ${serviceCase.title}`,
    actor_type: "employee",
    contact_id: serviceCase.contact_id,
    lead_id: serviceCase.source_lead_id,
    payload: {
      service_case_id: serviceCase.id,
      safety_flags,
      urgency,
    },
  });

  return serviceCase;
}

/** Create service case from an existing lead (repair/maintenance/winterization). */
export async function createServiceCaseFromLead(leadId: string): Promise<{
  serviceCase: ServiceCase;
}> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead nicht gefunden");

  const type: ServiceCaseType =
    lead.request_type === "maintenance"
      ? "maintenance"
      : lead.request_type === "winterization"
        ? "winterization"
        : lead.request_type === "extension"
          ? "extension"
          : "repair";

  const serviceCase = await createServiceCase({
    contact_id: lead.contact_id,
    property_id: lead.property_id,
    source_lead_id: lead.id,
    source_inbox_item_id: lead.inbox_item_id,
    type,
    urgency: lead.urgency,
    problem_description:
      lead.description_original || lead.summary_current || "Serviceanfrage",
    title: lead.summary_current?.slice(0, 80) || undefined,
  });

  return { serviceCase };
}

export async function updateServiceCase(
  id: string,
  patch: Partial<
    Pick<
      ServiceCase,
      | "status"
      | "urgency"
      | "type"
      | "next_action"
      | "next_action_due_at"
      | "resolution_summary"
      | "problem_description"
      | "title"
      | "scheduled_at"
    >
  >,
): Promise<ServiceCase> {
  const next: Record<string, unknown> = { ...patch };
  if (patch.status === "resolved" || patch.status === "closed") {
    next.resolved_at = new Date().toISOString();
  }

  const { data, error } = await sb()
    .from("service_cases")
    .update(next)
    .eq("id", id)
    .select("*")
    .single();
  throwOnError(error);
  const serviceCase = data as ServiceCase;

  await addTimelineEvent({
    type: "service_case_updated",
    title: "Servicefall aktualisiert",
    summary: Object.keys(patch).join(", "),
    actor_type: "employee",
    contact_id: serviceCase.contact_id,
    lead_id: serviceCase.source_lead_id,
    payload: { service_case_id: id, ...patch },
  });

  return serviceCase;
}

export async function countOpenServiceCases(): Promise<{
  open: number;
  urgent: number;
}> {
  const [open, urgent] = await Promise.all([
    sb()
      .from("service_cases")
      .select("id", { count: "exact", head: true })
      .not("status", "in", '("resolved","closed")'),
    sb()
      .from("service_cases")
      .select("id", { count: "exact", head: true })
      .not("status", "in", '("resolved","closed")')
      .in("urgency", ["high", "urgent"]),
  ]);
  throwOnError(open.error);
  throwOnError(urgent.error);
  return { open: open.count ?? 0, urgent: urgent.count ?? 0 };
}
