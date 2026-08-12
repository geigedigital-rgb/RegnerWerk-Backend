import type { Metadata } from "next";
import { PipelineBoard } from "@/components/crm/PipelineBoard";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return <PipelineBoard />;
}
