import type { Metadata } from "next";
import { AssistantsStudio } from "@/components/ai/AssistantsStudio";

export const metadata: Metadata = { title: "Assistenten" };

export default function AssistentenPage() {
  return <AssistantsStudio />;
}
