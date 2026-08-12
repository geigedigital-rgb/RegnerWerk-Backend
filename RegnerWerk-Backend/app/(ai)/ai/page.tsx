import type { Metadata } from "next";
import { AiOverviewDashboard } from "@/components/shell/AiOverviewDashboard";

export const metadata: Metadata = { title: "AI Übersicht" };

export default function AiOverviewPage() {
  return <AiOverviewDashboard />;
}
