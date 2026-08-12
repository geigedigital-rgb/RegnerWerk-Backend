import type { Metadata } from "next";
import { TestLabStudio } from "@/components/ai/TestLabStudio";

export const metadata: Metadata = { title: "Test Lab" };

export default function TestLabPage() {
  return <TestLabStudio />;
}
