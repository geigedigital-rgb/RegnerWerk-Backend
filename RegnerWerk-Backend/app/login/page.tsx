import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-aqua-deep">
          RegnerWerk Admin
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-forest">
          Anmelden
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Internes Operations-System — nur für Teammitglieder.
        </p>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-gray-400">Laden…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
