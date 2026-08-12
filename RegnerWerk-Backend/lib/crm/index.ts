import { getSupabaseAdmin } from "@/lib/supabase";
import {
  displayNameFromParts,
  normalizeEmail,
  normalizePhone,
} from "@/lib/crm/normalize";
import type {
  Contact,
  ContactChannel,
  CrmOverviewStats,
  InboxItem,
  InboxSourceType,
  Lead,
  Priority,
  RequestType,
  Task,
  TimelineEvent,
} from "@/lib/crm/types";

function sb() {
  return getSupabaseAdmin();
}

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// ─── Overview ───────────────────────────────────────────────────────────────

export async function getCrmOverviewStats(): Promise<CrmOverviewStats> {
  const client = sb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const nowIso = new Date().toISOString();

  const [
    inbox,
    leadsNew,
    tasksToday,
    tasksOverdue,
    noNext,
    stages,
  ] = await Promise.all([
    client
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "deferred"]),
    client
      .from("leads")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "needs_review", "contact_pending"]),
    client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .gte("due_at", todayStart.toISOString())
      .lte("due_at", todayEnd.toISOString()),
    client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "waiting"])
      .lt("due_at", nowIso),
    client
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("status", "in", '("converted","unqualified","archived")')
      .or("next_action.is.null,next_action.eq."),
    client.from("pipeline_stages").select("id, code, is_terminal"),
  ]);

  for (const r of [inbox, leadsNew, tasksToday, tasksOverdue, noNext]) {
    throwOnError(r.error);
  }

  let openOpportunities = 0;
  let offersWaitingFollowUp = 0;
  let activeMontageProjects = 0;
  let openServiceCases = 0;
  let urgentServiceCases = 0;

  if (!stages.error && stages.data) {
    const openStageIds = stages.data
      .filter((s) => !s.is_terminal)
      .map((s) => s.id as string);
    const followUpId = stages.data.find((s) => s.code === "follow_up")?.id as
      | string
      | undefined;
    const offerSentId = stages.data.find((s) => s.code === "offer_sent")?.id as
      | string
      | undefined;

    const [openOpp, follow, montage, serviceOpen, serviceUrgent] =
      await Promise.all([
        openStageIds.length
          ? client
              .from("opportunities")
              .select("id", { count: "exact", head: true })
              .in("stage_id", openStageIds)
          : Promise.resolve({ count: 0, error: null }),
        followUpId || offerSentId
          ? client
              .from("opportunities")
              .select("id", { count: "exact", head: true })
              .in(
                "stage_id",
                [followUpId, offerSentId].filter(Boolean) as string[],
              )
          : Promise.resolve({ count: 0, error: null }),
        client
          .from("montage_projects")
          .select("id", { count: "exact", head: true })
          .not("status", "in", '("completed","cancelled")'),
        client
          .from("service_cases")
          .select("id", { count: "exact", head: true })
          .not("status", "in", '("resolved","closed")'),
        client
          .from("service_cases")
          .select("id", { count: "exact", head: true })
          .not("status", "in", '("resolved","closed")')
          .in("urgency", ["high", "urgent"]),
      ]);
    openOpportunities = openOpp.count ?? 0;
    offersWaitingFollowUp = follow.count ?? 0;
    activeMontageProjects = montage.count ?? 0;
    openServiceCases = serviceOpen.count ?? 0;
    urgentServiceCases = serviceUrgent.count ?? 0;
  } else {
    // pipeline tables may be missing; still try service counts
    const [serviceOpen, serviceUrgent] = await Promise.all([
      client
        .from("service_cases")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("resolved","closed")'),
      client
        .from("service_cases")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("resolved","closed")')
        .in("urgency", ["high", "urgent"]),
    ]);
    openServiceCases = serviceOpen.count ?? 0;
    urgentServiceCases = serviceUrgent.count ?? 0;
  }

  return {
    inboxOpen: inbox.count ?? 0,
    leadsNew: leadsNew.count ?? 0,
    tasksOpenToday: tasksToday.count ?? 0,
    tasksOverdue: tasksOverdue.count ?? 0,
    leadsWithoutNextAction: noNext.count ?? 0,
    openOpportunities,
    offersWaitingFollowUp,
    activeMontageProjects,
    openServiceCases,
    urgentServiceCases,
  };
}

// ─── Contacts ───────────────────────────────────────────────────────────────

export async function listContacts(limit = 100): Promise<Contact[]> {
  const { data, error } = await sb()
    .from("contacts")
    .select("*")
    .is("merged_into_contact_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  throwOnError(error);
  return (data ?? []) as Contact[];
}

export async function getContact(id: string): Promise<Contact | null> {
  const { data, error } = await sb()
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOnError(error);
  return (data as Contact | null) ?? null;
}

export async function getContactChannels(
  contactId: string,
): Promise<ContactChannel[]> {
  const { data, error } = await sb()
    .from("contact_channels")
    .select("*")
    .eq("contact_id", contactId)
    .order("is_primary", { ascending: false });
  throwOnError(error);
  return (data ?? []) as ContactChannel[];
}

export async function findContactsByPhone(
  phone: string,
): Promise<Contact[]> {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  const { data, error } = await sb()
    .from("contact_channels")
    .select("contact_id")
    .eq("type", "phone")
    .eq("value_normalized", normalized)
    .limit(10);
  throwOnError(error);
  const ids = [...new Set((data ?? []).map((r) => r.contact_id as string))];
  if (!ids.length) return [];
  const { data: contacts, error: cErr } = await sb()
    .from("contacts")
    .select("*")
    .in("id", ids);
  throwOnError(cErr);
  return (contacts ?? []) as Contact[];
}

export async function createContact(input: {
  kind?: Contact["kind"];
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  email?: string;
  notes_public?: string;
}): Promise<Contact> {
  const display_name = displayNameFromParts({
    kind: input.kind ?? "person",
    first_name: input.first_name,
    last_name: input.last_name,
    company_name: input.company_name,
    fallback: input.phone || input.email || "Neuer Kontakt",
  });

  const { data, error } = await sb()
    .from("contacts")
    .insert({
      kind: input.kind ?? "person",
      first_name: input.first_name?.trim() || null,
      last_name: input.last_name?.trim() || null,
      company_name: input.company_name?.trim() || null,
      display_name,
      notes_public: input.notes_public?.trim() || null,
      customer_status: "lead",
    })
    .select("*")
    .single();
  throwOnError(error);
  const contact = data as Contact;

  const channels: Array<Record<string, unknown>> = [];
  if (input.phone?.trim()) {
    channels.push({
      contact_id: contact.id,
      type: "phone",
      value_raw: input.phone.trim(),
      value_normalized: normalizePhone(input.phone),
      is_primary: true,
      label: "mobil",
    });
  }
  if (input.email?.trim()) {
    channels.push({
      contact_id: contact.id,
      type: "email",
      value_raw: input.email.trim(),
      value_normalized: normalizeEmail(input.email),
      is_primary: !input.phone?.trim(),
      label: "privat",
    });
  }
  if (channels.length) {
    const { error: chErr } = await sb().from("contact_channels").insert(channels);
    throwOnError(chErr);
  }

  return contact;
}

// ─── Timeline ───────────────────────────────────────────────────────────────

export async function addTimelineEvent(input: {
  type: string;
  title: string;
  summary?: string;
  actor_type?: TimelineEvent["actor_type"];
  source?: string;
  contact_id?: string | null;
  lead_id?: string | null;
  inbox_item_id?: string | null;
  payload?: Record<string, unknown>;
}): Promise<TimelineEvent> {
  const { data, error } = await sb()
    .from("timeline_events")
    .insert({
      type: input.type,
      title: input.title,
      summary: input.summary ?? null,
      actor_type: input.actor_type ?? "system",
      source: input.source ?? null,
      contact_id: input.contact_id ?? null,
      lead_id: input.lead_id ?? null,
      inbox_item_id: input.inbox_item_id ?? null,
      payload: input.payload ?? {},
      occurred_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  throwOnError(error);
  return data as TimelineEvent;
}

export async function listTimelineForContact(
  contactId: string,
  limit = 50,
): Promise<TimelineEvent[]> {
  const { data, error } = await sb()
    .from("timeline_events")
    .select("*")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  throwOnError(error);
  return (data ?? []) as TimelineEvent[];
}

export async function listTimelineForLead(
  leadId: string,
  limit = 50,
): Promise<TimelineEvent[]> {
  const { data, error } = await sb()
    .from("timeline_events")
    .select("*")
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  throwOnError(error);
  return (data ?? []) as TimelineEvent[];
}

// ─── Inbox ──────────────────────────────────────────────────────────────────

export async function listInboxItems(opts?: {
  status?: string;
  limit?: number;
}): Promise<InboxItem[]> {
  let q = sb()
    .from("inbox_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.status === "open") {
    q = q.in("status", ["open", "in_progress", "deferred"]);
  } else if (opts?.status) {
    q = q.eq("status", opts.status);
  }

  const { data, error } = await q;
  throwOnError(error);
  return (data ?? []) as InboxItem[];
}

export async function getInboxItem(id: string): Promise<InboxItem | null> {
  const { data, error } = await sb()
    .from("inbox_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOnError(error);
  return (data as InboxItem | null) ?? null;
}

export async function createInboxItem(input: {
  source_type?: InboxSourceType;
  summary: string;
  request_type?: RequestType | null;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  postal_code?: string;
  priority?: Priority;
  payload?: Record<string, unknown>;
}): Promise<InboxItem> {
  let suggested_contact_id: string | null = null;
  let matched_confidence: string | null = null;

  if (input.contact_phone?.trim()) {
    const matches = await findContactsByPhone(input.contact_phone);
    if (matches.length === 1) {
      suggested_contact_id = matches[0].id;
      matched_confidence = "exact";
    } else if (matches.length > 1) {
      suggested_contact_id = matches[0].id;
      matched_confidence = "medium";
    }
  }

  const { data, error } = await sb()
    .from("inbox_items")
    .insert({
      source_type: input.source_type ?? "manual",
      summary: input.summary.trim(),
      request_type: input.request_type ?? null,
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      postal_code: input.postal_code?.trim() || null,
      priority: input.priority ?? "normal",
      payload: input.payload ?? {},
      status: "open",
      suggested_contact_id,
      matched_confidence,
      sla_due_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();
  throwOnError(error);
  const item = data as InboxItem;

  await addTimelineEvent({
    type: "inbox_item_created",
    title: "Inbox-Eintrag erstellt",
    summary: item.summary,
    source: item.source_type,
    inbox_item_id: item.id,
    contact_id: suggested_contact_id,
    payload: { inbox_item_id: item.id },
  });

  return item;
}

export async function rejectInboxItem(
  id: string,
  reason: string,
): Promise<InboxItem> {
  const { data, error } = await sb()
    .from("inbox_items")
    .update({
      status: "rejected",
      resolution: reason.trim(),
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  throwOnError(error);
  const item = data as InboxItem;
  await addTimelineEvent({
    type: "inbox_item_rejected",
    title: "Inbox abgelehnt",
    summary: reason,
    actor_type: "employee",
    inbox_item_id: item.id,
    contact_id: item.suggested_contact_id,
  });
  return item;
}

export async function markInboxSpam(id: string): Promise<InboxItem> {
  const { data, error } = await sb()
    .from("inbox_items")
    .update({
      status: "spam",
      resolution: "spam",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  throwOnError(error);
  return data as InboxItem;
}

/**
 * Accept inbox item as new lead (+ contact if needed). Vertical slice TZ §46.
 */
export async function acceptInboxAsLead(id: string): Promise<{
  inbox: InboxItem;
  lead: Lead;
  contact: Contact;
}> {
  const item = await getInboxItem(id);
  if (!item) throw new Error("Inbox-Eintrag nicht gefunden");
  if (item.lead_id) throw new Error("Bereits als Lead übernommen");

  let contact: Contact | null = null;
  if (item.suggested_contact_id) {
    contact = await getContact(item.suggested_contact_id);
  }
  if (!contact) {
    const nameParts = (item.contact_name ?? "").trim().split(/\s+/);
    const first = nameParts[0] || undefined;
    const last =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
    contact = await createContact({
      first_name: first,
      last_name: last,
      phone: item.contact_phone ?? undefined,
      email: item.contact_email ?? undefined,
    });
  }

  const { data: leadData, error: leadErr } = await sb()
    .from("leads")
    .insert({
      contact_id: contact.id,
      inbox_item_id: item.id,
      source: item.source_type,
      request_type: item.request_type,
      status: "new",
      urgency: item.priority,
      description_original: item.summary,
      summary_current: item.summary,
      next_action: "Erstkontakt / Rückruf",
      next_action_due_at: item.sla_due_at,
    })
    .select("*")
    .single();
  throwOnError(leadErr);
  const lead = leadData as Lead;

  const { data: inboxData, error: inboxErr } = await sb()
    .from("inbox_items")
    .update({
      status: "accepted",
      lead_id: lead.id,
      suggested_contact_id: contact.id,
      resolved_at: new Date().toISOString(),
      resolution: "accepted_as_lead",
    })
    .eq("id", id)
    .select("*")
    .single();
  throwOnError(inboxErr);

  await addTimelineEvent({
    type: "lead_created",
    title: "Lead aus Inbox erstellt",
    summary: lead.summary_current ?? undefined,
    actor_type: "employee",
    source: item.source_type,
    contact_id: contact.id,
    lead_id: lead.id,
    inbox_item_id: item.id,
  });

  return { inbox: inboxData as InboxItem, lead, contact };
}

// ─── Leads ──────────────────────────────────────────────────────────────────

export async function listLeads(limit = 100): Promise<Lead[]> {
  const { data, error } = await sb()
    .from("leads")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  throwOnError(error);
  return (data ?? []) as Lead[];
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await sb()
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOnError(error);
  return (data as Lead | null) ?? null;
}

export async function updateLead(
  id: string,
  patch: Partial<
    Pick<
      Lead,
      | "status"
      | "next_action"
      | "next_action_due_at"
      | "summary_current"
      | "urgency"
      | "unqualified_reason"
    >
  >,
): Promise<Lead> {
  if (patch.status === "unqualified" && !patch.unqualified_reason?.trim()) {
    throw new Error("unqualified erfordert eine Begründung");
  }
  const { data, error } = await sb()
    .from("leads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwOnError(error);
  const lead = data as Lead;
  await addTimelineEvent({
    type: "lead_updated",
    title: "Lead aktualisiert",
    summary: Object.keys(patch).join(", "),
    actor_type: "employee",
    contact_id: lead.contact_id,
    lead_id: lead.id,
    payload: patch as Record<string, unknown>,
  });
  return lead;
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function listTasks(opts?: {
  contactId?: string;
  leadId?: string;
  openOnly?: boolean;
}): Promise<Task[]> {
  let q = sb().from("tasks").select("*").order("due_at", { ascending: true });
  if (opts?.contactId) q = q.eq("related_contact_id", opts.contactId);
  if (opts?.leadId) q = q.eq("related_lead_id", opts.leadId);
  if (opts?.openOnly) q = q.in("status", ["open", "in_progress", "waiting"]);
  const { data, error } = await q.limit(100);
  throwOnError(error);
  return (data ?? []) as Task[];
}

export async function createTask(input: {
  title: string;
  description?: string;
  type?: Task["type"];
  priority?: Priority;
  due_at?: string | null;
  related_contact_id?: string | null;
  related_lead_id?: string | null;
  related_inbox_item_id?: string | null;
}): Promise<Task> {
  const { data, error } = await sb()
    .from("tasks")
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      type: input.type ?? "follow_up",
      priority: input.priority ?? "normal",
      due_at: input.due_at ?? null,
      related_contact_id: input.related_contact_id ?? null,
      related_lead_id: input.related_lead_id ?? null,
      related_inbox_item_id: input.related_inbox_item_id ?? null,
      status: "open",
      created_by_actor_type: "employee",
    })
    .select("*")
    .single();
  throwOnError(error);
  const task = data as Task;
  await addTimelineEvent({
    type: "task_created",
    title: "Aufgabe erstellt",
    summary: task.title,
    actor_type: "employee",
    contact_id: task.related_contact_id,
    lead_id: task.related_lead_id,
    payload: { task_id: task.id },
  });
  return task;
}
