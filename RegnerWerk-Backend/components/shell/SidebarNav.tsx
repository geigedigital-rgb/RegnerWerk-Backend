"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getWorkspace,
  isNavItemActive,
  resolveWorkspaceFromPath,
  type WorkspaceId,
} from "@/config/navigation";
import { cn } from "@/lib/cn";

type Props = {
  workspaceId?: WorkspaceId;
};

export function SidebarNav({ workspaceId }: Props) {
  const pathname = usePathname();
  const id = workspaceId ?? resolveWorkspaceFromPath(pathname);
  const workspace = getWorkspace(id);
  const isAi = workspace.accent === "ai";

  return (
    <aside
      className={cn(
        "sticky top-14 flex h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col overflow-y-auto border-r border-gray-100 bg-white",
        isAi && "border-l-[3px] border-l-lime",
      )}
    >
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {workspace.label}
        </p>
        <p className="mt-0.5 text-xs text-gray-600">{workspace.description}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-4 p-3">
        {workspace.groups.map((group) => (
          <div key={group.id}>
            {group.label ? (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors",
                        active
                          ? isAi
                            ? "bg-mint font-medium text-forest"
                            : "bg-forest/5 font-medium text-forest"
                          : "text-gray-600 hover:bg-gray-50 hover:text-forest",
                      )}
                    >
                      <Icon
                        size={15}
                        strokeWidth={1.75}
                        className={cn(
                          "shrink-0",
                          active && isAi ? "text-aqua-deep" : active ? "text-forest" : "text-gray-400",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
