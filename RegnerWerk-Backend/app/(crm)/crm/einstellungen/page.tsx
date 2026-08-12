import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "CRM-Einstellungen" };

export default function CrmEinstellungenPage() {
  return (
    <PlaceholderPage
      title="CRM-Einstellungen"
      description="Rollen, Status, SLA und Quellen — getrennt von KI-Einstellungen."
      tzRef="§7.11"
    />
  );
}
