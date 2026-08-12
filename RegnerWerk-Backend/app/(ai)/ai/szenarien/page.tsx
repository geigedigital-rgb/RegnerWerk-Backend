import type { Metadata } from "next";
import { ScenariosStudio } from "@/components/ai/ScenariosStudio";

export const metadata: Metadata = { title: "Szenarien" };

export default function SzenarienPage() {
  return <ScenariosStudio />;
}
