import type { Metadata } from "next";
import { TelephonySettings } from "@/components/ai/TelephonySettings";

export const metadata: Metadata = { title: "Telefonie" };

export default function TelefoniePage() {
  return <TelephonySettings />;
}
