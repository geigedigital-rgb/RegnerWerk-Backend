"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/auth/browser";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/crm";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      router.replace(next.startsWith("/") ? next : "/crm");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-forest">E-Mail</span>
        <input
          type="email"
          required
          autoComplete="username"
          className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm text-forest"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-forest">Passwort</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-2xl border border-gray-100 bg-ice px-4 py-3 text-sm text-forest"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-lime px-4 py-3 text-sm font-semibold text-forest disabled:opacity-50"
      >
        {loading ? "Anmelden…" : "Anmelden"}
      </button>
      <p className="text-center text-xs text-gray-400">
        Invite-only — Benutzer werden vom Owner angelegt.
      </p>
    </form>
  );
}
