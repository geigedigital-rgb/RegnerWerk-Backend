import type { Metadata } from "next";
import { InboxBoard } from "@/components/crm/InboxBoard";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return <InboxBoard />;
}
