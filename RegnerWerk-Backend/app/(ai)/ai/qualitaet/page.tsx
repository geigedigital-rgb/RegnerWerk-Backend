import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Qualität & Analytik" };

export default function QualitaetPage() {
  return (
    <PlaceholderPage
      title="Qualität & Analytik"
      description="QA-Reviews und Release-Vergleiche."
      tzRef="§19"
    />
  );
}
