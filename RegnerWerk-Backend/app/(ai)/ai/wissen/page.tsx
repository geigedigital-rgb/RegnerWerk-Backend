import type { Metadata } from "next";
import { KnowledgeStudio } from "@/components/ai/KnowledgeStudio";

export const metadata: Metadata = { title: "Wissensbasis" };

export default function WissenPage() {
  return <KnowledgeStudio />;
}
