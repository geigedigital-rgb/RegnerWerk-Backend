import type { Metadata } from "next";
import { MontageProjectDetail } from "@/components/crm/MontageProjectDetail";

export const metadata: Metadata = { title: "Montageprojekt" };

export default async function MontageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MontageProjectDetail projectId={id} />;
}
