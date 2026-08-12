import type { Metadata } from "next";
import { LiveCallsBoard } from "@/components/ai/LiveCallsBoard";

export const metadata: Metadata = { title: "Live Calls" };

export default function LiveCallsPage() {
  return <LiveCallsBoard />;
}
