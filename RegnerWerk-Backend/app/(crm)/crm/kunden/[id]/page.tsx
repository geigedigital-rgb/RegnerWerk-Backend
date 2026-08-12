import type { Metadata } from "next";
import { CustomerDetail } from "@/components/crm/CustomerDetail";

export const metadata: Metadata = { title: "Kunde" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerDetail contactId={id} />;
}
