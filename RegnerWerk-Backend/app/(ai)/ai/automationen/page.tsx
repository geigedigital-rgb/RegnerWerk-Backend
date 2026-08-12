import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Automationen" };

export default function AutomationenPage() {
  return (
    <PlaceholderPage
      title="Automationen"
      description="Ereignis → Bedingungen → Aktionen mit Simulation."
      tzRef="§17"
    />
  );
}
