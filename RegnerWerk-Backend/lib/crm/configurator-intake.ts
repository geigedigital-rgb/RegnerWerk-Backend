import { getSupabaseAdmin } from "@/lib/supabase";
import {
  addTimelineEvent,
  findOrCreateContactFromIdentity,
  listLeads,
} from "@/lib/crm";

const OPEN_LEAD_STATUSES = [
  "new",
  "needs_review",
  "contact_pending",
  "contacted",
  "qualified",
] as const;

export type SofortProjectLink = {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  place_label: string | null;
  pdf_path: string | null;
  status: string;
};

/**
 * Email on a Sofort submit → find/create Kundenkarte + open Lead,
 * then store contact_id / lead_id on the project row.
 */
export async function linkSubmittedProjectToCrm(
  project: SofortProjectLink,
): Promise<{ contactId: string; leadId: string } | null> {
  const email = project.customer_email?.trim();
  if (!email) return null;

  const { contact } = await findOrCreateContactFromIdentity({
    name: project.customer_name,
    email,
  });

  const existing = (await listLeads(20, { contactId: contact.id })).filter(
    (l) => (OPEN_LEAD_STATUSES as readonly string[]).includes(l.status),
  );
  let leadId = existing[0]?.id ?? null;

  if (!leadId) {
    const summary =
      project.place_label?.trim() ||
      `Konfigurator-Projekt ${project.id.slice(0, 8)}`;
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("leads")
      .insert({
        contact_id: contact.id,
        source: "configurator",
        request_type: "new_installation",
        status: "new",
        urgency: "normal",
        description_original: summary,
        summary_current: summary,
        next_action: "Plan prüfen / Rückruf",
        metadata: { project_id: project.id },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    leadId = data.id as string;
  }

  await addTimelineEvent({
    type: "configurator_project_submitted",
    title: "Konfigurator-Projekt gespeichert",
    summary: project.place_label || project.id,
    source: "configurator",
    actor_type: "customer",
    contact_id: contact.id,
    lead_id: leadId,
    payload: {
      project_id: project.id,
      pdf_path: project.pdf_path,
      status: project.status,
    },
  });

  return { contactId: contact.id, leadId };
}
