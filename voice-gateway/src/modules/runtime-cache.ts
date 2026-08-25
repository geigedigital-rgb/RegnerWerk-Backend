import { getCallRuntime, type CallRuntime } from "../agents/reception.js";
import {
  buildSlimAcceptBody,
  type SlimAcceptBody,
} from "./fast-accept.js";

type PreparedAccept = {
  runtime: CallRuntime;
  slimBody: SlimAcceptBody;
  builtAt: number;
};

const TTL_MS = 60_000;
let cache: PreparedAccept | null = null;
let refreshInFlight: Promise<PreparedAccept> | null = null;

async function buildPrepared(): Promise<PreparedAccept> {
  const runtime = await getCallRuntime();
  const welcome = runtime.welcome;
  const instructions =
    typeof runtime.agent.instructions === "string"
      ? runtime.agent.instructions
      : `Begin with exactly: '${welcome}'`;
  const slimBody = buildSlimAcceptBody({
    model: runtime.assistant.model || "gpt-realtime",
    voice: runtime.assistant.voice || "alloy",
    instructions,
    welcome,
  });
  return { runtime, slimBody, builtAt: Date.now() };
}

export async function getPreparedAccept(
  force = false,
): Promise<PreparedAccept> {
  if (!force && cache && Date.now() - cache.builtAt < TTL_MS) {
    return cache;
  }
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = buildPrepared()
    .then((prepared) => {
      cache = prepared;
      return prepared;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function preloadCallRuntime(): Promise<void> {
  await getPreparedAccept(true);
}

export function startCallRuntimeRefresh(intervalMs = TTL_MS): NodeJS.Timeout {
  return setInterval(() => {
    void getPreparedAccept(true).catch((err) => {
      console.warn("[runtime-cache] refresh failed", err);
    });
  }, intervalMs);
}

export function peekPreparedAccept(): PreparedAccept | null {
  return cache;
}
