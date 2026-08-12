import type { Metadata } from "next";
import { CallsList } from "@/components/ai/CallsList";

export const metadata: Metadata = { title: "Anrufe" };

export default function AnrufePage() {
  return <CallsList />;
}
