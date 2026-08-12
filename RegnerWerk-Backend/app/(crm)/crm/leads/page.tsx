import type { Metadata } from "next";
import { LeadsList } from "@/components/crm/LeadsList";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return <LeadsList />;
}
