import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Dokumente" };

export default function DokumentePage() {
  return (
    <PlaceholderPage
      title="Dokumente"
      description="Alle Dateien mit Entity-Verknüpfung."
      tzRef="§7.9"
    />
  );
}
