/** Shared CRM domain types (TZ Stage 1 vertical slice). */

export type ContactKind = "person" | "company";
export type CustomerStatus = "lead" | "active" | "inactive" | "archived";

export type ChannelType = "phone" | "email";

export type InboxSourceType =
  | "website"
  | "ai_call"
  | "phone"
  | "missed_call"
  | "manual"
  | "import"
  | "configurator"
  | "other";

export type InboxStatus =
  | "open"
  | "in_progress"
  | "accepted"
  | "linked"
  | "deferred"
  | "spam"
  | "rejected"
  | "resolved";

export type Priority = "low" | "normal" | "high" | "urgent";

export type RequestType =
  | "new_installation"
  | "repair"
  | "extension"
  | "maintenance"
  | "winterization"
  | "component_purchase"
  | "commercial"
  | "other"
  | "spam";

export type LeadStatus =
  | "new"
  | "needs_review"
  | "contact_pending"
  | "contacted"
  | "qualified"
  | "unqualified"
  | "converted"
  | "archived";

export type TaskStatus =
  | "open"
  | "in_progress"
  | "waiting"
  | "completed"
  | "cancelled";

export type TaskType =
  | "follow_up"
  | "callback"
  | "meeting"
  | "site_visit"
  | "internal"
  | "service"
  | "other";

export type ActorType = "customer" | "employee" | "ai" | "system";

export type Contact = {
  id: string;
  created_at: string;
  updated_at: string;
  kind: ContactKind;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  display_name: string;
  preferred_language: string;
  customer_status: CustomerStatus;
  do_not_contact: boolean;
  notes_public: string | null;
  notes_internal_sensitive: string | null;
  merged_into_contact_id: string | null;
};

export type ContactChannel = {
  id: string;
  contact_id: string;
  type: ChannelType;
  value_raw: string;
  value_normalized: string;
  label: string | null;
  is_primary: boolean;
  verified_at: string | null;
};

export type InboxItem = {
  id: string;
  created_at: string;
  updated_at: string;
  source_type: InboxSourceType;
  source_id: string | null;
  status: InboxStatus;
  priority: Priority;
  suggested_contact_id: string | null;
  matched_confidence: string | null;
  summary: string;
  request_type: RequestType | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  postal_code: string | null;
  payload: Record<string, unknown>;
  assigned_to: string | null;
  sla_due_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  duplicate_of_id: string | null;
  lead_id: string | null;
};

export type Lead = {
  id: string;
  created_at: string;
  updated_at: string;
  contact_id: string | null;
  property_id: string | null;
  inbox_item_id: string | null;
  source: string;
  request_type: RequestType | null;
  status: LeadStatus;
  urgency: Priority;
  description_original: string | null;
  summary_current: string | null;
  owner_id: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  qualification_result: string | null;
  unqualified_reason: string | null;
  last_contact_at: string | null;
  converted_opportunity_id?: string | null;
};

export type PipelineStage = {
  id: string;
  code: string;
  label_de: string;
  sort_order: number;
  is_terminal: boolean;
  is_won: boolean;
  is_lost: boolean;
  active: boolean;
};

export type Opportunity = {
  id: string;
  created_at: string;
  updated_at: string;
  lead_id: string | null;
  contact_id: string | null;
  property_id: string | null;
  service_type: string | null;
  stage_id: string;
  owner_id: string | null;
  amount_min_minor: number | null;
  amount_max_minor: number | null;
  currency: string;
  expected_close_date: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  loss_reason: string | null;
  loss_note: string | null;
  title: string | null;
  summary: string | null;
};

export type OpportunityListItem = Opportunity & {
  stage_code: string;
  stage_label: string;
  contact_name: string | null;
};

export type MontageProjectStatus =
  | "handover"
  | "planning"
  | "scheduled"
  | "installation"
  | "commissioning"
  | "documentation"
  | "first_season"
  | "completed"
  | "paused"
  | "cancelled";

export type MontageProject = {
  id: string;
  created_at: string;
  updated_at: string;
  opportunity_id: string | null;
  contact_id: string | null;
  property_id: string | null;
  status: MontageProjectStatus;
  project_number: string;
  name: string;
  scope_summary: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
};

export type TimelineEvent = {
  id: string;
  created_at: string;
  occurred_at: string;
  type: string;
  actor_type: ActorType;
  actor_id: string | null;
  source: string | null;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  contact_id: string | null;
  property_id: string | null;
  lead_id: string | null;
  inbox_item_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  visibility: string;
};

export type Task = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_by_actor_type: ActorType;
  related_contact_id: string | null;
  related_lead_id: string | null;
  related_inbox_item_id: string | null;
};

export type CrmOverviewStats = {
  inboxOpen: number;
  leadsNew: number;
  tasksOpenToday: number;
  tasksOverdue: number;
  leadsWithoutNextAction: number;
  openOpportunities: number;
  offersWaitingFollowUp: number;
  activeMontageProjects: number;
  openServiceCases: number;
  urgentServiceCases: number;
};

export type ServiceCaseType =
  | "repair"
  | "extension"
  | "maintenance"
  | "winterization"
  | "spring_start"
  | "first_season"
  | "other";

export type ServiceCaseStatus =
  | "new"
  | "triage"
  | "scheduled"
  | "in_progress"
  | "waiting_customer"
  | "waiting_parts"
  | "resolved"
  | "closed";

export type ServiceCase = {
  id: string;
  created_at: string;
  updated_at: string;
  contact_id: string | null;
  property_id: string | null;
  irrigation_system_id: string | null;
  source_lead_id: string | null;
  source_call_id: string | null;
  source_inbox_item_id: string | null;
  type: ServiceCaseType;
  status: ServiceCaseStatus;
  urgency: Priority;
  problem_description: string;
  safety_flags: string[];
  owner_id: string | null;
  scheduled_at: string | null;
  resolved_at: string | null;
  resolution_summary: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  case_number: string;
  title: string | null;
};

export type ServiceCaseListItem = ServiceCase & {
  contact_name: string | null;
};
