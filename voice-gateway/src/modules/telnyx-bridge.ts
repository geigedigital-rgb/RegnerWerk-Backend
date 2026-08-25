/**
 * Remember recent inbound Telnyx legs so we can hang up if OpenAI accept fails.
 */
type Entry = { callControlId: string; from: string | null; at: number };

const TTL_MS = 120_000;
const byFrom = new Map<string, Entry>();
let lastInbound: Entry | null = null;

function prune(now = Date.now()) {
  for (const [k, v] of byFrom) {
    if (now - v.at > TTL_MS) byFrom.delete(k);
  }
  if (lastInbound && now - lastInbound.at > TTL_MS) lastInbound = null;
}

export function trackInboundTelnyx(opts: {
  callControlId: string;
  from: string | null;
}) {
  const entry: Entry = {
    callControlId: opts.callControlId,
    from: opts.from,
    at: Date.now(),
  };
  lastInbound = entry;
  if (opts.from) byFrom.set(opts.from, entry);
  prune();
}

export function takeInboundTelnyx(from?: string | null): string | null {
  prune();
  if (from && byFrom.has(from)) {
    const id = byFrom.get(from)!.callControlId;
    byFrom.delete(from);
    if (lastInbound?.callControlId === id) lastInbound = null;
    return id;
  }
  if (lastInbound) {
    const id = lastInbound.callControlId;
    lastInbound = null;
    return id;
  }
  return null;
}
