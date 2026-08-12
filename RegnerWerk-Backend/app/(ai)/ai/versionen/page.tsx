import type { Metadata } from "next";
import { VersionsOverview } from "@/components/ai/VersionsOverview";

export const metadata: Metadata = { title: "Versionen & Logs" };

export default function VersionenPage() {
  return <VersionsOverview />;
}
