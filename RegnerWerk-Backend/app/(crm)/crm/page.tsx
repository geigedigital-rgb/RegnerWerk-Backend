import type { Metadata } from "next";
import { CrmOverviewDashboard } from "@/components/crm/CrmOverviewDashboard";

export const metadata: Metadata = { title: "CRM Übersicht" };

export default function CrmOverviewPage() {
  return <CrmOverviewDashboard />;
}
