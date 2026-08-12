import type { Metadata } from "next";
import { PromptStudio } from "@/components/ai/PromptStudio";

export const metadata: Metadata = { title: "Prompt Studio" };

export default function PromptsPage() {
  return <PromptStudio />;
}
