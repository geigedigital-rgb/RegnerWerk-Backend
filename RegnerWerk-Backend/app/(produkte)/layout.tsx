import { AdminShell } from "@/components/shell/AdminShell";

export default function ProdukteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell workspaceId="produkte">{children}</AdminShell>;
}
