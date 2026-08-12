import { AdminShell } from "@/components/shell/AdminShell";

export default function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell workspaceId="crm">{children}</AdminShell>;
}
