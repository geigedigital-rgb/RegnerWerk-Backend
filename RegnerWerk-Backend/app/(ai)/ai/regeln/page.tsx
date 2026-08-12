import type { Metadata } from "next";
import { RulesStudio } from "@/components/ai/RulesStudio";

export const metadata: Metadata = { title: "Regeln & Stop-Trigger" };

export default function RegelnPage() {
  return <RulesStudio />;
}
