import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Berichte" };

export default function BerichtePage() {
  return (
    <PlaceholderPage
      title="Berichte"
      description="Conversion, SLA, Anrufqualität und Kosten."
      tzRef="§7.10"
    />
  );
}
