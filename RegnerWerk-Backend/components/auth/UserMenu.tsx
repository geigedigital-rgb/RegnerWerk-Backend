"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";

type Me = {
  displayName: string;
  email: string | null;
  roles: string[];
};

export function UserMenu() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMe(data.user);
      } catch {
        /* ignore */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={me?.displayName || "Profil"}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-2 text-white/80 hover:bg-white/15"
      >
        <UserRound size={14} />
        <span className="hidden max-w-[7rem] truncate text-[11px] lg:inline">
          {me?.displayName || "…"}
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white p-3 text-forest shadow-sm">
          <p className="text-sm font-medium">{me?.displayName || "Benutzer"}</p>
          <p className="truncate text-xs text-gray-500">{me?.email}</p>
          {me?.roles?.length ? (
            <p className="mt-1 text-[11px] text-gray-400">
              {me.roles.join(", ")}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <LogOut size={14} />
            Abmelden
          </button>
        </div>
      ) : null}
    </div>
  );
}
