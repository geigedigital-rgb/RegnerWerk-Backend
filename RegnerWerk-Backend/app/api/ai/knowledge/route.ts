import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import {
  listKnowledgeArticles,
  listKnowledgeCategories,
  upsertKnowledgeArticle,
} from "@/lib/ai/knowledge";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
    const [categories, articles] = await Promise.all([
      listKnowledgeCategories(),
      listKnowledgeArticles({ status, categoryId }),
    ]);
    return NextResponse.json({ categories, articles });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireApiUser("ai.prompt.edit");
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as {
      id?: string;
      category_id?: string;
      title?: string;
      content?: string;
      language?: string;
      sensitivity?: string;
      source?: string;
      change_note?: string;
    };
    if (!body.category_id || !body.title?.trim() || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "category_id, title und content erforderlich" },
        { status: 400 },
      );
    }
    const article = await upsertKnowledgeArticle({
      id: body.id,
      category_id: body.category_id,
      title: body.title,
      content: body.content,
      language: body.language,
      sensitivity: body.sensitivity,
      source: body.source,
      change_note: body.change_note,
      owner_id: gate.user!.id,
    });
    return NextResponse.json({ article }, { status: body.id ? 200 : 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fehler" },
      { status: 500 },
    );
  }
}
