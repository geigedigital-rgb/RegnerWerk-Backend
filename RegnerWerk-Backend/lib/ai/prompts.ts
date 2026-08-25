import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { runTestSuite } from "@/lib/ai/test-lab";

export type PromptDocument = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  required: boolean;
  locked: boolean;
  active: boolean;
};

export type PromptVersion = {
  id: string;
  prompt_document_id: string;
  version: number;
  status: string;
  content: string;
  content_hash: string;
  change_note: string | null;
  created_at: string;
  updated_at: string;
};

export type PromptRelease = {
  id: string;
  environment: string;
  label: string | null;
  compiled_content: string;
  compiled_hash: string;
  change_comment: string | null;
  published_at: string;
  is_active: boolean;
  dependency_snapshot: Record<string, unknown>;
};

export type PromptStudioBlock = PromptDocument & {
  draft: PromptVersion | null;
  published: PromptVersion | null;
};

function hashContent(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function compilePromptBlocks(
  blocks: { code: string; name: string; content: string }[],
): { compiled: string; hash: string } {
  const compiled = blocks
    .map((b) => `## ${b.name} (${b.code})\n${b.content.trim()}`)
    .filter((s) => s.length > 10)
    .join("\n\n");
  return { compiled, hash: hashContent(compiled) };
}

export async function listPromptStudio(): Promise<{
  blocks: PromptStudioBlock[];
  activeRelease: PromptRelease | null;
}> {
  const sb = getSupabaseAdmin();
  const { data: docs, error } = await sb
    .from("prompt_documents")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  const docIds = (docs ?? []).map((d) => d.id);
  const { data: versions, error: vErr } = await sb
    .from("prompt_versions")
    .select("*")
    .in("prompt_document_id", docIds.length ? docIds : ["00000000-0000-0000-0000-000000000000"])
    .in("status", ["draft", "published"])
    .order("version", { ascending: false });
  if (vErr) throw new Error(vErr.message);

  const byDoc = new Map<string, PromptVersion[]>();
  for (const v of versions ?? []) {
    const list = byDoc.get(v.prompt_document_id) ?? [];
    list.push(v as PromptVersion);
    byDoc.set(v.prompt_document_id, list);
  }

  const blocks: PromptStudioBlock[] = (docs ?? []).map((d) => {
    const list = byDoc.get(d.id) ?? [];
    const draft = list.find((v) => v.status === "draft") ?? null;
    const published = list.find((v) => v.status === "published") ?? null;
    return {
      ...(d as PromptDocument),
      draft,
      published,
    };
  });

  const { data: release } = await sb
    .from("prompt_releases")
    .select("*")
    .eq("environment", "production")
    .eq("is_active", true)
    .is("retired_at", null)
    .maybeSingle();

  return {
    blocks,
    activeRelease: (release as PromptRelease | null) ?? null,
  };
}

export async function savePromptDraft(opts: {
  documentId: string;
  content: string;
  changeNote?: string;
  userId?: string;
}): Promise<PromptVersion> {
  const sb = getSupabaseAdmin();
  const content = opts.content;
  const content_hash = hashContent(content);

  const { data: existing } = await sb
    .from("prompt_versions")
    .select("*")
    .eq("prompt_document_id", opts.documentId)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await sb
      .from("prompt_versions")
      .update({
        content,
        content_hash,
        change_note: opts.changeNote ?? existing.change_note,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as PromptVersion;
  }

  const { data: maxRow } = await sb
    .from("prompt_versions")
    .select("version")
    .eq("prompt_document_id", opts.documentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (maxRow?.version ?? 0) + 1;

  const { data, error } = await sb
    .from("prompt_versions")
    .insert({
      prompt_document_id: opts.documentId,
      version: nextVersion,
      status: "draft",
      content,
      content_hash,
      change_note: opts.changeNote ?? "Draft update",
      created_by: opts.userId ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PromptVersion;
}

export async function publishPromptRelease(opts: {
  environment?: "development" | "staging" | "production";
  label?: string;
  changeComment?: string;
  userId?: string;
}): Promise<PromptRelease> {
  const env = opts.environment ?? "production";
  const { blocks } = await listPromptStudio();
  const compiledBlocks = blocks
    .filter((b) => b.draft || b.published)
    .map((b) => ({
      code: b.code,
      name: b.name,
      content: (b.draft ?? b.published)!.content,
      versionId: (b.draft ?? b.published)!.id,
      version: (b.draft ?? b.published)!.version,
      documentId: b.id,
    }));

  for (const b of blocks.filter((x) => x.required)) {
    const content = (b.draft ?? b.published)?.content?.trim();
    if (!content) {
      throw new Error(`Pflichtblock leer: ${b.code}`);
    }
  }

  const suite = await runTestSuite({
    criticalOnly: true,
    userId: opts.userId,
  });
  if (suite.criticalFailed > 0) {
    const fails = suite.results
      .filter((r) => !r.passed && r.critical)
      .map((r) => r.code)
      .join(", ");
    throw new Error(
      `Publish blockiert: critical Test Lab fails (${suite.criticalFailed}): ${fails}`,
    );
  }

  const { compiled, hash } = compilePromptBlocks(compiledBlocks);
  const sb = getSupabaseAdmin();

  // Mark current active as inactive
  await sb
    .from("prompt_releases")
    .update({ is_active: false })
    .eq("environment", env)
    .eq("is_active", true);

  // Promote drafts → published (new version rows stay; status flip)
  for (const b of compiledBlocks) {
    await sb
      .from("prompt_versions")
      .update({ status: "published" })
      .eq("id", b.versionId);
  }

  const { data, error } = await sb
    .from("prompt_releases")
    .insert({
      environment: env,
      label: opts.label ?? `Release ${new Date().toISOString().slice(0, 16)}`,
      compiled_content: compiled,
      compiled_hash: hash,
      dependency_snapshot: {
        blocks: compiledBlocks.map((b) => ({
          code: b.code,
          name: b.name,
          documentId: b.documentId,
          versionId: b.versionId,
          version: b.version,
          content: b.content,
        })),
      },
      change_comment: opts.changeComment ?? null,
      published_by: opts.userId ?? null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PromptRelease;
}

export async function getActivePromptRelease(
  environment = "production",
): Promise<PromptRelease | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("prompt_releases")
    .select("*")
    .eq("environment", environment)
    .eq("is_active", true)
    .is("retired_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PromptRelease | null) ?? null;
}

export type PromptReleaseReview = {
  id: string;
  release_id: string;
  author_id: string | null;
  rating: number | null;
  comment: string;
  created_at: string;
  author_email?: string | null;
  author_name?: string | null;
};

export type PromptReleaseListItem = PromptRelease & {
  avg_rating: number | null;
  review_count: number;
};

export async function listPromptReleases(
  limit = 20,
): Promise<PromptReleaseListItem[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("prompt_releases")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const releases = (data ?? []) as PromptRelease[];
  if (releases.length === 0) return [];

  const ids = releases.map((r) => r.id);
  const { data: reviews } = await sb
    .from("prompt_release_reviews")
    .select("release_id, rating")
    .in("release_id", ids);

  const agg = new Map<string, { sum: number; n: number; total: number }>();
  for (const row of reviews ?? []) {
    const cur = agg.get(row.release_id) ?? { sum: 0, n: 0, total: 0 };
    cur.total += 1;
    if (typeof row.rating === "number") {
      cur.sum += row.rating;
      cur.n += 1;
    }
    agg.set(row.release_id, cur);
  }

  return releases.map((r) => {
    const a = agg.get(r.id);
    return {
      ...r,
      review_count: a?.total ?? 0,
      avg_rating: a && a.n > 0 ? Math.round((a.sum / a.n) * 10) / 10 : null,
    };
  });
}

export async function getPromptRelease(
  releaseId: string,
): Promise<{
  release: PromptRelease;
  reviews: PromptReleaseReview[];
}> {
  const sb = getSupabaseAdmin();
  const { data: release, error } = await sb
    .from("prompt_releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!release) throw new Error("Release nicht gefunden");

  const { data: reviews, error: rErr } = await sb
    .from("prompt_release_reviews")
    .select("*")
    .eq("release_id", releaseId)
    .order("created_at", { ascending: false });
  if (rErr) throw new Error(rErr.message);

  const authorIds = [
    ...new Set(
      (reviews ?? [])
        .map((r) => r.author_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const profileMap = new Map<string, { display_name?: string }>();
  if (authorIds.length) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, display_name")
      .in("id", authorIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, {
        display_name: p.display_name ?? undefined,
      });
    }
  }

  return {
    release: release as PromptRelease,
    reviews: (reviews ?? []).map((r) => {
      const p = r.author_id ? profileMap.get(r.author_id) : undefined;
      return {
        ...(r as PromptReleaseReview),
        author_email: null,
        author_name: p?.display_name ?? null,
      };
    }),
  };
}

export async function addPromptReleaseReview(opts: {
  releaseId: string;
  rating?: number | null;
  comment?: string;
  userId?: string;
}): Promise<PromptReleaseReview> {
  const rating =
    opts.rating == null || opts.rating === 0
      ? null
      : Math.min(5, Math.max(1, Math.round(opts.rating)));
  const comment = (opts.comment ?? "").trim();
  if (rating == null && !comment) {
    throw new Error("Bewertung oder Kommentar erforderlich");
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("prompt_release_reviews")
    .insert({
      release_id: opts.releaseId,
      author_id: opts.userId ?? null,
      rating,
      comment,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PromptReleaseReview;
}

/** Load a release's blocks into draft editors (does not activate production). */
export async function restoreReleaseToDrafts(
  releaseId: string,
  userId?: string,
): Promise<{ restored: number }> {
  const { release } = await getPromptRelease(releaseId);
  const snap = release.dependency_snapshot as {
    blocks?: Array<{
      documentId?: string;
      code?: string;
      content?: string;
    }>;
  };
  const blocks = snap.blocks ?? [];
  if (!blocks.length) {
    throw new Error(
      "Dieses Release hat keinen Block-Snapshot — Rollback (Live) möglich, Entwurf laden nicht.",
    );
  }

  const { blocks: studio } = await listPromptStudio();
  for (const b of blocks) {
    const content = b.content?.trim();
    if (!content) continue;
    let documentId = b.documentId;
    if (!documentId && b.code) {
      documentId = studio.find((s) => s.code === b.code)?.id;
    }
    if (!documentId) continue;
    await savePromptDraft({
      documentId,
      content,
      changeNote: `Geladen aus Release ${release.label ?? releaseId.slice(0, 8)}`,
      userId,
    });
  }

  const restored = blocks.filter((b) => b.content?.trim()).length;
  return { restored };
}

export async function createPromptDocument(opts: {
  code: string;
  name: string;
  description?: string;
  content?: string;
  userId?: string;
}): Promise<PromptDocument> {
  const code = opts.code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_|_$/g, "");
  if (!code) throw new Error("Code erforderlich");
  const sb = getSupabaseAdmin();
  const { data: maxSort } = await sb
    .from("prompt_documents")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await sb
    .from("prompt_documents")
    .insert({
      code,
      name: opts.name.trim() || code,
      description: opts.description?.trim() || null,
      sort_order: (maxSort?.sort_order ?? 0) + 10,
      required: false,
      locked: false,
      active: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const doc = data as PromptDocument;
  if (opts.content?.trim()) {
    await savePromptDraft({
      documentId: doc.id,
      content: opts.content,
      changeNote: "Initial draft",
      userId: opts.userId,
    });
  }
  return doc;
}

export async function rollbackPromptRelease(
  releaseId: string,
  userId?: string,
): Promise<PromptRelease> {
  const sb = getSupabaseAdmin();
  const { data: target, error } = await sb
    .from("prompt_releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!target) throw new Error("Release nicht gefunden");

  await sb
    .from("prompt_releases")
    .update({ is_active: false })
    .eq("environment", target.environment)
    .eq("is_active", true);

  // Create a new active release clone pointing at same compiled content
  const { data, error: insErr } = await sb
    .from("prompt_releases")
    .insert({
      environment: target.environment,
      label: `Rollback → ${target.label ?? target.id.slice(0, 8)}`,
      compiled_content: target.compiled_content,
      compiled_hash: target.compiled_hash,
      dependency_snapshot: {
        ...(target.dependency_snapshot as object),
        rollback_of: target.id,
      },
      change_comment: `Rollback von ${target.id}`,
      published_by: userId ?? null,
      is_active: true,
    })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);

  // Also restore drafts so editor matches live
  try {
    await restoreReleaseToDrafts(releaseId, userId);
  } catch {
    /* older releases without content snapshot */
  }

  return data as PromptRelease;
}
