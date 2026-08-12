import type { Metadata } from "next";
import { OpportunityDetail } from "@/components/crm/OpportunityDetail";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpportunityDetail opportunityId={id} />;
}
