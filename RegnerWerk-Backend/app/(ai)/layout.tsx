import { AdminShell } from "@/components/shell/AdminShell";

export default function AiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell workspaceId="ai">{children}</AdminShell>;
}
