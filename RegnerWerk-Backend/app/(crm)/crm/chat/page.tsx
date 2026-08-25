import type { Metadata } from "next";
import { ChatInquiriesBoard } from "@/components/crm/ChatInquiriesBoard";

export const metadata: Metadata = { title: "Support-Chat" };

export default function ChatInquiriesPage() {
  return <ChatInquiriesBoard />;
}
