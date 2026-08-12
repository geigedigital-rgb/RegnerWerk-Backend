import type { Metadata } from "next";
import { MontageProjectsList } from "@/components/crm/MontageProjectsList";

export const metadata: Metadata = { title: "Montageprojekte" };

export default function MontagePage() {
  return <MontageProjectsList />;
}
