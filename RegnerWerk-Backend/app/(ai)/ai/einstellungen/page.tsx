import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "KI-Einstellungen" };

export default function KiEinstellungenPage() {
  return (
    <PlaceholderPage
      title="KI-Einstellungen"
      description="Modelle, Limits, Privacy und Not-Aus."
      tzRef="§8.4"
    />
  );
}
