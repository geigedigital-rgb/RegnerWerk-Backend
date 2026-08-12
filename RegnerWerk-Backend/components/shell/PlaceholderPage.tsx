import Link from "next/link";
import { Construction } from "lucide-react";

type Props = {
  title: string;
  description: string;
  tzRef?: string;
  children?: React.ReactNode;
};

export function PlaceholderPage({ title, description, tzRef, children }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-gray-100 bg-white p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint">
          <Construction size={20} className="text-aqua-deep" strokeWidth={1.75} />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-forest">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {description}
        </p>
        {tzRef ? (
          <p className="mt-3 text-xs text-gray-400">
            Spezifikation: RegnerWerk_CRM_AI_TZ.md {tzRef}
          </p>
        ) : null}
        <div className="mt-6 rounded-2xl border border-dashed border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Dieser Bereich ist vorbereitet. Die Datenbasis und Logik folgen in den
          nächsten Entwicklungsphasen.
        </div>
        {children}
        <p className="mt-6 text-xs text-gray-400">
          Zurück zur{" "}
          <Link href="/ai" className="text-aqua-deep hover:underline">
            AI Übersicht
          </Link>{" "}
          oder zum{" "}
          <Link href="/crm" className="text-aqua-deep hover:underline">
            CRM
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
