import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Aufgaben & Kalender" };

export default function AufgabenPage() {
  return (
    <PlaceholderPage
      title="Aufgaben & Kalender"
      description="Aufgaben, Termine und Follow-ups."
      tzRef="§7.8"
    />
  );
}
