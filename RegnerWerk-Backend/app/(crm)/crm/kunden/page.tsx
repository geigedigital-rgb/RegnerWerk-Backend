import type { Metadata } from "next";
import { CustomersList } from "@/components/crm/CustomersList";

export const metadata: Metadata = { title: "Kunden" };

export default function CustomersPage() {
  return <CustomersList />;
}
