/**
 * Evaluate stop rules (TZ §16).
 * Prefers Admin rule release; always also applies local farewell / critical phrases.
 */

export type StopRuleAction =
  | { type: "none" }
  | { type: "transfer_human"; reason: string }
  | { type: "mark_urgent"; reason: string }
  | { type: "end_politely"; reason: string };

type RemoteRule = {
  code: string;
  match_type: string;
  pattern: string;
  priority: number;
  action_type: string;
  action_payload?: Record<string, unknown>;
  enabled?: boolean;
};

/** Always-on local rules (farewell + safety) — remote list must not disable these. */
const LOCAL_ALWAYS: Array<{ pattern: RegExp; action: StopRuleAction }> = [
  {
    pattern:
      /\b(tschüss|tschüß|tschues|tschus|ciao|bye|goodbye|auf wiedersehen|auf wiederhören|auf wiederhoren|schönen tag noch|schoenen tag noch|das war'?s|das wars|ich leg(e)? auf|auflegen)\b/i,
    action: { type: "end_politely", reason: "caller_goodbye" },
  },
  {
    pattern:
      /\b(mitarbeiter|chef|persönlicher ansprechpartner|sofort verbinden)\b/i,
    action: { type: "transfer_human", reason: "human_request" },
  },
  {
    pattern: /\b(rohrbruch|wasserschaden|notfall)\b/i,
    action: { type: "mark_urgent", reason: "emergency_water" },
  },
  {
    pattern: /\b(anwalt|datenschutz|beschwerde)\b/i,
    action: { type: "transfer_human", reason: "legal_or_privacy" },
  },
];

let cachedRules: RemoteRule[] | null = null;
let cachedAt = 0;

async function loadRemoteRules(): Promise<RemoteRule[] | null> {
  if (cachedRules && Date.now() - cachedAt < 30_000) return cachedRules;

  const adminUrl = (
    process.env.ADMIN_API_URL ||
    process.env.REGNERWERK_ADMIN_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
  const secret = process.env.VOICE_GATEWAY_SECRET;

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
      headers["x-voice-gateway-key"] = secret;
    }
    const res = await fetch(`${adminUrl}/api/ai/rules/published`, {
      headers,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return cachedRules;
    const data = (await res.json()) as { release?: { rules?: RemoteRule[] } };
    cachedRules = data.release?.rules ?? [];
    cachedAt = Date.now();
    return cachedRules;
  } catch {
    return cachedRules;
  }
}

function mapAction(rule: RemoteRule): StopRuleAction {
  const reason =
    (rule.action_payload?.reason as string | undefined) ?? rule.code;
  switch (rule.action_type) {
    case "transfer_call":
    case "request_human_approval":
    case "stop_questionnaire":
      return { type: "transfer_human", reason };
    case "mark_urgent":
      return { type: "mark_urgent", reason };
    case "end_call_politely":
      return { type: "end_politely", reason };
    default:
      return { type: "transfer_human", reason };
  }
}

function matchLocal(transcript: string): StopRuleAction {
  for (const rule of LOCAL_ALWAYS) {
    if (rule.pattern.test(transcript)) {
      console.info("[stop-rules] matched local", rule.action);
      return rule.action;
    }
  }
  return { type: "none" };
}

export function evaluateStopRules(transcript: string): StopRuleAction {
  void loadRemoteRules();

  // Farewell / critical local first — must hang up on tschüss/ciao even if remote rules load.
  const local = matchLocal(transcript);
  if (local.type !== "none") return local;

  const rules = cachedRules;
  if (rules?.length) {
    const sorted = [...rules]
      .filter((r) => r.enabled !== false)
      .sort((a, b) => a.priority - b.priority);
    for (const rule of sorted) {
      try {
        const pattern = rule.pattern.replace(/^\(\?[imsux]+\)/, "");
        const re = new RegExp(pattern, "i");
        if (re.test(transcript)) {
          const action = mapAction(rule);
          console.info("[stop-rules] matched remote", rule.code, action);
          return action;
        }
      } catch {
        /* skip bad pattern */
      }
    }
  }

  return { type: "none" };
}

/** Warm cache at process start */
export async function preloadStopRules(): Promise<void> {
  await loadRemoteRules();
}
