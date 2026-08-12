import { PDF_BUCKET, getSupabaseAdmin } from "@/lib/supabase";
import {
  placeLabelFromPayload,
  sanitizeOptionalText,
  type ProjectPayload,
} from "@/lib/project-schema";
import { buildProjectPdf } from "@/lib/pdf/project-pdf";

export type ProjectStatus = "submitted" | "draft";

export type ProjectRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: ProjectStatus;
  place_id: string;
  place_label: string;
  customer_email: string | null;
  customer_name: string | null;
  payload: ProjectPayload;
  pdf_path: string | null;
  parent_id: string | null;
};

export type ProjectListItem = Omit<ProjectRow, "payload"> & {
  head_count: number | null;
  lawn_area_m2: number | null;
  total_eur: number | null;
};

function metaFromPayload(payload: ProjectPayload) {
  const plan = payload.sofortPlan;
  return {
    head_count: plan?.heads?.length ?? null,
    lawn_area_m2: plan?.lawnAreaM2 ?? null,
    total_eur: plan?.totalKnownEur ?? null,
  };
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("projects")
    .select(
      "id, created_at, updated_at, status, place_id, place_label, customer_email, customer_name, pdf_path, parent_id, payload",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const payload = row.payload as ProjectPayload;
    const { payload: _p, ...rest } = row as ProjectRow;
    return { ...rest, ...metaFromPayload(payload) };
  });
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProjectRow | null) ?? null;
}

async function uploadPdf(projectId: string, bytes: Uint8Array): Promise<string> {
  const sb = getSupabaseAdmin();
  const path = `${projectId}/plan.pdf`;
  const { error } = await sb.storage.from(PDF_BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(`PDF upload failed: ${error.message}`);
  return path;
}

export async function generateAndStorePdf(
  projectId: string,
  payload: ProjectPayload,
  meta?: { customerName?: string | null; customerEmail?: string | null },
): Promise<string> {
  const bytes = await buildProjectPdf(payload, {
    projectId,
    customerName: meta?.customerName ?? null,
    customerEmail: meta?.customerEmail ?? null,
  });
  return uploadPdf(projectId, bytes);
}

export type UpsertProjectInput = {
  payload: ProjectPayload;
  status: ProjectStatus;
  customerEmail?: string | null;
  customerName?: string | null;
  projectId?: string;
  parentId?: string | null;
  withPdf?: boolean;
};

export async function upsertProject(
  input: UpsertProjectInput,
): Promise<ProjectRow> {
  const sb = getSupabaseAdmin();
  const email = sanitizeOptionalText(input.customerEmail ?? null);
  const name = sanitizeOptionalText(input.customerName ?? null);
  const row = {
    status: input.status,
    place_id: input.payload.place.id,
    place_label: placeLabelFromPayload(input.payload),
    customer_email: email,
    customer_name: name,
    payload: {
      ...input.payload,
      updatedAt: new Date().toISOString(),
      plotStage: input.payload.plotStage ?? "ergebnis",
    },
    parent_id: input.parentId ?? null,
  };

  let project: ProjectRow;

  if (input.projectId) {
    const { data, error } = await sb
      .from("projects")
      .update(row)
      .eq("id", input.projectId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    project = data as ProjectRow;
  } else {
    const { data, error } = await sb
      .from("projects")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    project = data as ProjectRow;
  }

  if (input.withPdf !== false) {
    const pdfPath = await generateAndStorePdf(project.id, input.payload, {
      customerName: name,
      customerEmail: email,
    });
    const { data: updated, error: upErr } = await sb
      .from("projects")
      .update({ pdf_path: pdfPath })
      .eq("id", project.id)
      .select("*")
      .single();
    if (upErr) throw new Error(upErr.message);
    project = updated as ProjectRow;
  }

  return project;
}

export async function duplicateProject(id: string): Promise<ProjectRow> {
  const src = await getProject(id);
  if (!src) throw new Error("Project not found");

  return upsertProject({
    payload: src.payload,
    status: "draft",
    customerEmail: src.customer_email,
    customerName: src.customer_name
      ? `${src.customer_name} (Kopie)`
      : "Kopie",
    parentId: src.id,
    withPdf: true,
  });
}

export async function deleteProject(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const existing = await getProject(id);
  if (existing?.pdf_path) {
    await sb.storage.from(PDF_BUCKET).remove([existing.pdf_path]);
  }
  const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getPdfBytes(id: string): Promise<Uint8Array | null> {
  const project = await getProject(id);
  if (!project) return null;

  const sb = getSupabaseAdmin();

  if (project.pdf_path) {
    const { data, error } = await sb.storage
      .from(PDF_BUCKET)
      .download(project.pdf_path);
    if (!error && data) {
      return new Uint8Array(await data.arrayBuffer());
    }
  }

  // Regenerate if missing
  const path = await generateAndStorePdf(project.id, project.payload, {
    customerName: project.customer_name,
    customerEmail: project.customer_email,
  });
  await sb.from("projects").update({ pdf_path: path }).eq("id", id);
  const { data, error } = await sb.storage.from(PDF_BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? "PDF download failed");
  return new Uint8Array(await data.arrayBuffer());
}

export function frontendOpenUrl(projectId: string): string {
  const base = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/konfigurator?projectId=${encodeURIComponent(projectId)}`;
}
