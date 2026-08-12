import { AdminShell } from "@/components/shell/AdminShell";

export default function ProjekteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell workspaceId="projekte">{children}</AdminShell>;
}
