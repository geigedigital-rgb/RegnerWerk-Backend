"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Plus,
  Search,
} from "lucide-react";
import { Database } from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SidebarNav } from "./SidebarNav";
import { UserMenu } from "@/components/auth/UserMenu";
import type { WorkspaceId } from "@/config/navigation";
import { cn } from "@/lib/cn";

type GatewayHealth = {
  status: "ok" | "error" | "offline";
  activeCalls?: number;
  version?: string;
};

type Props = {
  workspaceId: WorkspaceId;
  children: React.ReactNode;
};

export function AdminShell({ workspaceId, children }: Props) {
  const [health, setHealth] = useState<GatewayHealth>({ status: "offline" });

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/ai/health", { cache: "no-store" });
        const data = (await res.json()) as GatewayHealth;
        if (!cancelled) {
          setHealth({
            status: res.ok && data.status === "ok" ? "ok" : "error",
            activeCalls: data.activeCalls,
            version: data.version,
          });
        }
      } catch {
        if (!cancelled) setHealth({ status: "offline" });
      }
    }
    void poll();
    const id = window.setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const statusLabel =
    health.status === "ok"
      ? "Gateway online"
      : health.status === "error"
        ? "Gateway Fehler"
        : "Gateway offline";

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-forest-mid bg-forest text-white">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4 lg:px-6">
          <Link href="/produkte" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime/15">
              <Database size={16} className="text-lime" strokeWidth={1.75} />
            </span>
            <span className="hidden text-[15px] font-bold tracking-tight sm:inline">
              Regner<span className="text-lime">Werk</span>
              <span className="ml-1.5 font-normal text-white/60">Admin</span>
            </span>
          </Link>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <WorkspaceSwitcher workspaceId={workspaceId} />
          </div>

          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              disabled
              title="Globale Suche folgt in Phase 2"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/40"
            >
              <Search size={14} />
              <span className="hidden lg:inline">Suche</span>
            </button>
            <button
              type="button"
              disabled
              title="Schnellerstellung folgt in Phase 2"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/40"
            >
              <Plus size={14} />
              <span className="hidden lg:inline">Erstellen</span>
            </button>
            <button
              type="button"
              disabled
              title="Keine Benachrichtigungen"
              className="relative inline-flex items-center rounded-lg px-2.5 py-1.5 text-white/40"
            >
              <Bell size={14} />
            </button>
          </div>

          <Link
            href="/ai"
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
              health.status === "ok"
                ? "border-lime/40 bg-lime/10 text-lime"
                : "border-white/15 bg-white/5 text-white/55",
            )}
            title={statusLabel}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                health.status === "ok" ? "bg-lime" : "bg-white/40",
              )}
            />
            {statusLabel}
          </Link>

          <UserMenu />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <SidebarNav workspaceId={workspaceId} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
