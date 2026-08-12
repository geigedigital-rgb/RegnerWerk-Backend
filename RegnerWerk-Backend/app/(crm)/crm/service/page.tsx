import type { Metadata } from "next";
import { ServiceCasesBoard } from "@/components/crm/ServiceCasesBoard";

export const metadata: Metadata = { title: "Service" };

export default function ServicePage() {
  return <ServiceCasesBoard />;
}
