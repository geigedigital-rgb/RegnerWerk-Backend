import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-aqua-deep">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-0.5 text-xl font-bold tracking-tight text-forest sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-xl text-sm text-gray-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    hint?: string;
    href?: string;
    tone?: "neutral" | "ok" | "warn" | "bad";
  }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const inner = (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {item.label}
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-bold tracking-tight",
                item.tone === "ok" && "text-aqua-deep",
                item.tone === "warn" && "text-amber-700",
                item.tone === "bad" && "text-red-700",
                (!item.tone || item.tone === "neutral") && "text-forest",
              )}
            >
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-0.5 text-[11px] text-gray-500">{item.hint}</p>
            ) : null}
          </>
        );
        const className =
          "rounded-2xl border border-gray-100 bg-white px-3.5 py-3";
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={cn(className, "transition-colors hover:bg-gray-50")}
          >
            {inner}
          </Link>
        ) : (
          <div key={item.label} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function QuickLinks({
  items,
}: {
  items: Array<{
    href: string;
    label: string;
    desc?: string;
    icon?: LucideIcon;
  }>;
}) {
  return (
    <ul className="divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-100 bg-white">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50"
            >
              {Icon ? (
                <Icon size={15} className="shrink-0 text-aqua-deep" />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-forest">
                  {item.label}
                </span>
                {item.desc ? (
                  <span className="block text-[11px] text-gray-500">
                    {item.desc}
                  </span>
                ) : null}
              </span>
              <ArrowRight size={14} className="shrink-0 text-gray-300" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-gray-100 bg-white p-4",
        className,
      )}
    >
      {title || action ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Flash({
  tone,
  children,
}: {
  tone: "error" | "ok";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-2xl border px-3.5 py-2.5 text-sm",
        tone === "error" && "border-red-100 bg-red-50 text-red-800",
        tone === "ok" && "border-emerald-100 bg-emerald-50 text-emerald-800",
      )}
    >
      {children}
    </p>
  );
}

export function OpsPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

export function CompactTable({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? (
        <p className="border-t border-gray-50 px-3 py-6 text-center text-sm text-gray-500">
          {empty}
        </p>
      ) : null}
    </div>
  );
}
