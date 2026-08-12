import type { Metadata } from "next";
import { ServiceCaseDetail } from "@/components/crm/ServiceCaseDetail";

export const metadata: Metadata = { title: "Servicefall" };

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ServiceCaseDetail caseId={id} />;
}
