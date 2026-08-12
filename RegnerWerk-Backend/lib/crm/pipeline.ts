import { getSupabaseAdmin } from "@/lib/supabase";
import { addTimelineEvent, getLead } from "@/lib/crm";
import type {
  MontageProject,
  Opportunity,
  OpportunityListItem,
  PipelineStage,
} from "@/lib/crm/types";

function sb() {
  return getSupabaseAdmin();
}

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listPipelineStages(): Promise<PipelineStage[]> {
  const { data, error } = await sb()
    .from("pipeline_stages")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  throwOnError(error);
  return (data ?? []) as PipelineStage[];
}

async function getStageByCode(code: string): Promise<PipelineStage> {
  const { data, error } = await sb()
    .from("pipeline_stages")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error(`Pipeline-Stage fehlt: ${code}`);
  return data as PipelineStage;
}

async function getStageById(id: string): Promise<PipelineStage> {
  const { data, error } = await sb()
    .from("pipeline_stages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error("Stage nicht gefunden");
  return data as PipelineStage;
}

export async function listOpportunities(): Promise<OpportunityListItem[]> {
  const { data, error } = await sb()
    .from("opportunities")
    .select(
      "*, pipeline_stages(code, label_de), contacts(display_name)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  throwOnError(error);

  return (data ?? []).map((row) => {
    const r = row as Opportunity & {
      pipeline_stages?: { code: string; label_de: string } | null;
      contacts?: { display_name: string } | null;
    };
    const { pipeline_stages, contacts, ...opp } = r;
    return {
      ...(opp as Opportunity),
      stage_code: pipeline_stages?.code ?? "",
      stage_label: pipeline_stages?.label_de ?? "",
      contact_name: contacts?.display_name ?? null,
    };
  });
}

export async function getOpportunity(id: string): Promise<{
  opportunity: Opportunity;
  stage: PipelineStage;
  history: Array<{
    id: string;
    created_at: string;
    from_stage_id: string | null;
    to_stage_id: string;
    reason: string | null;
    from_label?: string;
    to_label?: string;
  }>;
} | null> {
  const { data, error } = await sb()
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOnError(error);
  if (!data) return null;
  const opportunity = data as Opportunity;
  const stage = await getStageById(opportunity.stage_id);

  const { data: hist, error: hErr } = await sb()
    .from("opportunity_stage_history")
    .select("*")
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  throwOnError(hErr);

  const stages = await listPipelineStages();
  const byId = new Map(stages.map((s) => [s.id, s]));

  return {
    opportunity,
    stage,
    history: (hist ?? []).map((h) => ({
      id: h.id as string,
      created_at: h.created_at as string,
      from_stage_id: (h.from_stage_id as string | null) ?? null,
      to_stage_id: h.to_stage_id as string,
      reason: (h.reason as string | null) ?? null,
      from_label: h.from_stage_id
        ? byId.get(h.from_stage_id as string)?.label_de
        : undefined,
      to_label: byId.get(h.to_stage_id as string)?.label_de,
    })),
  };
}

/**
 * Convert qualified lead → opportunity (TZ §7.3 / §7.5).
 * Keeps the original lead; sets status=converted.
 */
export async function convertLeadToOpportunity(leadId: string): Promise<{
  lead: Awaited<ReturnType<typeof getLead>>;
  opportunity: Opportunity;
}> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead nicht gefunden");
  if (lead.status === "converted" && lead.converted_opportunity_id) {
    const existing = await getOpportunity(lead.converted_opportunity_id);
    if (existing) {
      return { lead, opportunity: existing.opportunity };
    }
  }
  if (lead.status === "unqualified" || lead.status === "archived") {
    throw new Error("Lead kann in diesem Status nicht konvertiert werden");
  }
  if (!lead.contact_id) {
    throw new Error("Lead braucht einen verknüpften Kontakt");
  }

  const stage = await getStageByCode("qualification");
  const title =
    lead.summary_current?.slice(0, 120) ||
    lead.description_original?.slice(0, 120) ||
    "Neue Chance";

  const { data, error } = await sb()
    .from("opportunities")
    .insert({
      lead_id: lead.id,
      contact_id: lead.contact_id,
      property_id: lead.property_id,
      service_type: lead.request_type,
      stage_id: stage.id,
      title,
      summary: lead.summary_current || lead.description_original,
      next_action: lead.next_action || "Qualifikation vertiefen",
      next_action_due_at: lead.next_action_due_at,
    })
    .select("*")
    .single();
  throwOnError(error);
  const opportunity = data as Opportunity;

  await sb().from("opportunity_stage_history").insert({
    opportunity_id: opportunity.id,
    from_stage_id: null,
    to_stage_id: stage.id,
    changed_by_actor_type: "employee",
    reason: "lead_converted",
  });

  const { data: leadUpdated, error: leadErr } = await sb()
    .from("leads")
    .update({
      status: "converted",
      converted_opportunity_id: opportunity.id,
    })
    .eq("id", lead.id)
    .select("*")
    .single();
  throwOnError(leadErr);

  await addTimelineEvent({
    type: "opportunity_created",
    title: "Lead in Pipeline übernommen",
    summary: title,
    actor_type: "employee",
    contact_id: lead.contact_id,
    lead_id: lead.id,
    payload: { opportunity_id: opportunity.id },
  });

  // Mark customer active
  await sb()
    .from("contacts")
    .update({ customer_status: "active" })
    .eq("id", lead.contact_id)
    .eq("customer_status", "lead");

  return { lead: leadUpdated as NonNullable<typeof lead>, opportunity };
}

export async function moveOpportunityStage(opts: {
  opportunityId: string;
  toStageCode: string;
  reason?: string;
  lossReason?: string;
  lossNote?: string;
}): Promise<{ opportunity: Opportunity; montageProject?: MontageProject }> {
  const detail = await getOpportunity(opts.opportunityId);
  if (!detail) throw new Error("Opportunity nicht gefunden");

  const from = detail.stage;
  const to = await getStageByCode(opts.toStageCode);

  if (from.id === to.id) {
    return { opportunity: detail.opportunity };
  }

  // AI must not set won/lost — server allows employee UI only; still block empty loss reason
  if (to.is_lost && !opts.lossReason?.trim()) {
    throw new Error("Verlustgrund erforderlich");
  }

  const patch: Record<string, unknown> = {
    stage_id: to.id,
  };
  if (to.is_won) {
    patch.won_at = new Date().toISOString();
    patch.lost_at = null;
    patch.next_action = "Übergabe an Montage";
  }
  if (to.is_lost) {
    patch.lost_at = new Date().toISOString();
    patch.loss_reason = opts.lossReason!.trim();
    patch.loss_note = opts.lossNote?.trim() || null;
    patch.next_action = null;
  }

  const { data, error } = await sb()
    .from("opportunities")
    .update(patch)
    .eq("id", opts.opportunityId)
    .select("*")
    .single();
  throwOnError(error);
  const opportunity = data as Opportunity;

  await sb().from("opportunity_stage_history").insert({
    opportunity_id: opportunity.id,
    from_stage_id: from.id,
    to_stage_id: to.id,
    changed_by_actor_type: "employee",
    reason: opts.reason || (to.is_lost ? opts.lossReason : null),
  });

  await addTimelineEvent({
    type: "opportunity_stage_changed",
    title: `Pipeline: ${from.label_de} → ${to.label_de}`,
    summary: opts.reason || opts.lossReason || undefined,
    actor_type: "employee",
    contact_id: opportunity.contact_id,
    lead_id: opportunity.lead_id,
    payload: {
      opportunity_id: opportunity.id,
      from: from.code,
      to: to.code,
    },
  });

  let montageProject: MontageProject | undefined;
  if (to.is_won) {
    montageProject = await createMontageFromOpportunity(opportunity);
  }

  return { opportunity, montageProject };
}

function montageNumber(now = new Date()): string {
  const y = now.getFullYear();
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `MP-${y}-${n}`;
}

export async function createMontageFromOpportunity(
  opportunity: Opportunity,
): Promise<MontageProject> {
  // Idempotent: one montage project per opportunity
  const { data: existing, error: exErr } = await sb()
    .from("montage_projects")
    .select("*")
    .eq("opportunity_id", opportunity.id)
    .maybeSingle();
  throwOnError(exErr);
  if (existing) return existing as MontageProject;

  const name =
    opportunity.title ||
    `Montage ${opportunity.id.slice(0, 8)}`;

  const { data, error } = await sb()
    .from("montage_projects")
    .insert({
      opportunity_id: opportunity.id,
      contact_id: opportunity.contact_id,
      property_id: opportunity.property_id,
      status: "handover",
      project_number: montageNumber(),
      name,
      scope_summary: opportunity.summary,
      next_action: "Kickoff / Planung starten",
      next_action_due_at: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .select("*")
    .single();
  throwOnError(error);
  const project = data as MontageProject;

  await addTimelineEvent({
    type: "project_started",
    title: "Montageprojekt angelegt",
    summary: `${project.project_number} · ${project.name}`,
    actor_type: "system",
    contact_id: project.contact_id,
    lead_id: opportunity.lead_id,
    payload: {
      montage_project_id: project.id,
      opportunity_id: opportunity.id,
    },
  });

  return project;
}

export async function listMontageProjects(): Promise<
  Array<MontageProject & { contact_name: string | null }>
> {
  const { data, error } = await sb()
    .from("montage_projects")
    .select("*, contacts(display_name)")
    .order("updated_at", { ascending: false })
    .limit(100);
  throwOnError(error);
  return (data ?? []).map((row) => {
    const r = row as MontageProject & {
      contacts?: { display_name: string } | null;
    };
    const { contacts, ...proj } = r;
    return {
      ...(proj as MontageProject),
      contact_name: contacts?.display_name ?? null,
    };
  });
}

export async function getMontageProject(id: string): Promise<MontageProject | null> {
  const { data, error } = await sb()
    .from("montage_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOnError(error);
  return (data as MontageProject | null) ?? null;
}

export async function updateMontageProject(
  id: string,
  patch: Partial<
    Pick<
      MontageProject,
      "status" | "next_action" | "next_action_due_at" | "scope_summary" | "name"
    >
  >,
): Promise<MontageProject> {
  const { data, error } = await sb()
    .from("montage_projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwOnError(error);
  return data as MontageProject;
}
