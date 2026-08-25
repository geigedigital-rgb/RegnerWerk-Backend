"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquareText, RefreshCw } from "lucide-react";

type ChatInquiry = {
  id: string;
  reference_code: string;
  received_at: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  message: string | null;
  landing_page: string | null;
  lead_id: string | null;
  inbox_item_id: string | null;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function ChatInquiriesBoard() {
  const [items, setItems] = useState<ChatInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/chat-inquiries", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen");
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Support-Chat</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Website-Chats mit Rückrufwunsch — gespeichert als CRM-Leads. Wissensbasis
            unter{" "}
            <Link href="/ai/wissen" className="text-emerald-800 underline-offset-2 hover:underline">
              KI → Wissen
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Laden…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center">
          <MessageSquareText className="mx-auto h-8 w-8 text-zinc-300" />
          <p className="mt-3 text-sm text-zinc-600">Noch keine Chat-Anfragen.</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {items.map((item) => {
            const open = openId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium text-zinc-900">
                      {item.name || "Ohne Name"} · {item.reference_code}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatDate(item.received_at)}
                      {item.postal_code ? ` · PLZ ${item.postal_code}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {[item.phone, item.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </button>
                {open && (
                  <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm">
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                      {item.message || "—"}
                    </pre>
                    <div className="flex flex-wrap gap-2">
                      {item.lead_id && (
                        <Link
                          href={`/crm/leads/${item.lead_id}`}
                          className="rounded-lg bg-emerald-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                        >
                          Lead öffnen
                        </Link>
                      )}
                      {item.inbox_item_id && (
                        <Link
                          href="/crm/inbox"
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          Inbox
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
