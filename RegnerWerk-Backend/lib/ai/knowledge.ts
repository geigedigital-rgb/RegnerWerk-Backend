import { getSupabaseAdmin } from "@/lib/supabase";

export type KnowledgeCategory = {
  id: string;
  code: string;
  name_de: string;
  description: string | null;
  sort_order: number;
};

export type KnowledgeArticle = {
  id: string;
  category_id: string;
  title: string;
  language: string;
  content: string;
  source: string | null;
  status: string;
  sensitivity: string;
  version: number;
  published_at: string | null;
  change_note: string | null;
  updated_at: string;
  category?: KnowledgeCategory | null;
};

export async function listKnowledgeCategories(): Promise<KnowledgeCategory[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("knowledge_categories")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as KnowledgeCategory[];
}

export async function listKnowledgeArticles(opts?: {
  status?: string;
  categoryId?: string;
}): Promise<KnowledgeArticle[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("knowledge_articles")
    .select("*, knowledge_categories(*)")
    .order("updated_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const cat = row.knowledge_categories as KnowledgeCategory | KnowledgeCategory[] | null;
    const category = Array.isArray(cat) ? cat[0] : cat;
    const { knowledge_categories: _, ...rest } = row as Record<string, unknown> & {
      knowledge_categories?: unknown;
    };
    return { ...(rest as KnowledgeArticle), category: category ?? null };
  });
}

export async function getKnowledgeArticle(id: string): Promise<KnowledgeArticle | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("knowledge_articles")
    .select("*, knowledge_categories(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const cat = data.knowledge_categories as KnowledgeCategory | KnowledgeCategory[] | null;
  const category = Array.isArray(cat) ? cat[0] : cat;
  const { knowledge_categories: _, ...rest } = data as Record<string, unknown> & {
    knowledge_categories?: unknown;
  };
  return { ...(rest as KnowledgeArticle), category: category ?? null };
}

export async function upsertKnowledgeArticle(input: {
  id?: string;
  category_id: string;
  title: string;
  content: string;
  language?: string;
  sensitivity?: string;
  source?: string;
  change_note?: string;
  owner_id?: string;
}): Promise<KnowledgeArticle> {
  const sb = getSupabaseAdmin();
  if (input.id) {
    const { data, error } = await sb
      .from("knowledge_articles")
      .update({
        category_id: input.category_id,
        title: input.title.trim(),
        content: input.content,
        language: input.language ?? "de",
        sensitivity: input.sensitivity ?? "normal",
        source: input.source,
        change_note: input.change_note,
        status: "draft",
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as KnowledgeArticle;
  }

  const { data, error } = await sb
    .from("knowledge_articles")
    .insert({
      category_id: input.category_id,
      title: input.title.trim(),
      content: input.content,
      language: input.language ?? "de",
      sensitivity: input.sensitivity ?? "normal",
      source: input.source ?? "manual",
      change_note: input.change_note,
      owner_id: input.owner_id ?? null,
      status: "draft",
      version: 1,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as KnowledgeArticle;
}

export async function publishKnowledgeArticle(
  id: string,
  userId?: string,
): Promise<KnowledgeArticle> {
  const existing = await getKnowledgeArticle(id);
  if (!existing) throw new Error("Artikel nicht gefunden");
  if (!existing.content.trim()) throw new Error("Inhalt leer");

  const nextVersion =
    existing.status === "published" ? existing.version + 1 : existing.version;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("knowledge_articles")
    .update({
      status: "published",
      version: nextVersion,
      published_at: new Date().toISOString(),
      approved_by: userId ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as KnowledgeArticle;
}

export async function listPublishedKnowledgeForGateway(): Promise<
  Array<{
    id: string;
    title: string;
    category: string;
    content: string;
    sensitivity: string;
  }>
> {
  const articles = await listKnowledgeArticles({ status: "published" });
  return articles.map((a) => ({
    id: a.id,
    title: a.title,
    category: a.category?.code ?? "unknown",
    content: a.content,
    sensitivity: a.sensitivity,
  }));
}
