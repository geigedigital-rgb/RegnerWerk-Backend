"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  WORKSPACES,
  getWorkspace,
  isNavItemActive,
  resolveWorkspaceFromPath,
  type WorkspaceId,
} from "@/config/navigation";
import { cn } from "@/lib/cn";

type Props = {
  workspaceId?: WorkspaceId;
};

export function WorkspaceSwitcher({ workspaceId }: Props) {
  const pathname = usePathname();
  const activeId = workspaceId ?? resolveWorkspaceFromPath(pathname);

  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-white/10 p-0.5">
      {WORKSPACES.map((ws) => {
        const active = ws.id === activeId;
        return (
          <Link
            key={ws.id}
            href={ws.href}
            title={ws.description}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
              active
                ? ws.accent === "ai"
                  ? "bg-lime text-forest"
                  : "bg-white text-forest"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {ws.label}
          </Link>
        );
      })}
    </div>
  );
}

export function WorkspaceLabel({ workspaceId }: Props) {
  const pathname = usePathname();
  const id = workspaceId ?? resolveWorkspaceFromPath(pathname);
  return <span className="sr-only">{getWorkspace(id).label}</span>;
}
