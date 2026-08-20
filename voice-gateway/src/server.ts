import fastifyFactory from "fastify";
import fastifyRawBody from "fastify-raw-body";
import formbody from "@fastify/formbody";
import dotenv from "dotenv";
import OpenAI from "openai";
import { APIError, InvalidWebhookSignatureError } from "openai/error";
import {
  OpenAIRealtimeSIP,
  RealtimeItem,
  RealtimeSession,
  type RealtimeSessionOptions,
} from "@openai/agents/realtime";
import { getCallRuntime } from "./agents/reception.js";
import { createCallRecord, updateCallLifecycle } from "./modules/supabase.js";
import { lookupByPhone } from "./modules/crm-lookup.js";
import { evaluateStopRules, preloadStopRules } from "./modules/stop-rules.js";
import {
  loadTelephonyRuntime,
  preloadTelephonyRuntime,
} from "./modules/telephony-runtime.js";
import { selectTransferTarget } from "./modules/transfer.js";
import {
  answerCall,
  openaiSipConfigured,
  parseTelnyxEvent,
  telnyxConfigured,
  transferToSip,
} from "./modules/telnyx.js";
import { loadPublishedAssistant } from "./modules/assistant.js";

dotenv.config();

const PORT = Number(process.env.PORT ?? 8000);
const VERSION = "0.3.0-wired";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const OPENAI_WEBHOOK_SECRET = process.env.OPENAI_WEBHOOK_SECRET?.trim();
const OPENAI_SIP_URI = process.env.OPENAI_SIP_URI?.trim();
const TELNYX_PHONE = process.env.TELNYX_PHONE_NUMBER?.trim() || null;
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID?.trim() || null;

/** Dev mode: health works without keys; webhooks require keys. */
const openaiReady = Boolean(OPENAI_API_KEY && OPENAI_WEBHOOK_SECRET);
const telnyxReady = telnyxConfigured();
const sipReady = openaiSipConfigured();

async function main() {
  const fastify = fastifyFactory({ logger: true });
  await fastify.register(formbody);
  await fastify.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
    routes: ["/openai/webhook"],
  });

  const activeCallTasks = new Map<string, Promise<void>>();

  fastify.get("/health", async () => {
    const [runtime, assistant] = await Promise.all([
      loadTelephonyRuntime().catch(() => null),
      loadPublishedAssistant("empfang").catch(() => null),
    ]);
    return {
      status: "ok",
      activeCalls: activeCallTasks.size,
      version: VERSION,
      openaiConfigured: openaiReady,
      telnyxConfigured: telnyxReady,
      openaiSipConfigured: sipReady,
      telnyxPhone: TELNYX_PHONE,
      telnyxConnectionId: TELNYX_CONNECTION_ID,
      webhookTelnyx: "/api/webhooks/telnyx",
      webhookOpenAI: "/openai/webhook",
      pilotMode: runtime?.pilotMode ?? "unknown",
      recordingEnabled: runtime?.recordingEnabled ?? false,
      assistant: assistant
        ? {
            source: assistant.source,
            name: assistant.name,
            model: assistant.model,
            voice: assistant.voice,
            vad: assistant.conversation.vadType,
            interrupt: assistant.conversation.interruptResponse,
          }
        : null,
    };
  });

  fastify.get("/", async () => ({
    status: "ok",
    service: "regnerwerk-voice-gateway",
    version: VERSION,
  }));

  if (!openaiReady) {
    fastify.log.warn(
      "OPENAI_API_KEY / OPENAI_WEBHOOK_SECRET missing — health only, webhooks disabled",
    );
  }

  const openai = openaiReady
    ? new OpenAI({
        apiKey: OPENAI_API_KEY!,
        webhookSecret: OPENAI_WEBHOOK_SECRET!,
      })
    : null;

  async function acceptCall(
    callId: string,
    startingAgent: Awaited<ReturnType<typeof getCallRuntime>>["agent"],
    sessionOptions: Partial<RealtimeSessionOptions>,
  ) {
    if (!openai) return;
    try {
      const initialConfig = await OpenAIRealtimeSIP.buildInitialConfig(
        startingAgent,
        sessionOptions,
      );
      await openai.realtime.calls.accept(callId, initialConfig);
      fastify.log.info(`Accepted call ${callId}`);
    } catch (error) {
      if (error instanceof APIError && error.status === 404) {
        fastify.log.warn(`Call ${callId} no longer exists when accepting`);
        return;
      }
      throw error;
    }
  }

  function logHistoryItem(item: RealtimeItem): void {
    if (item.type !== "message") return;

    if (item.role === "user") {
      for (const content of item.content) {
        const text =
          content.type === "input_text"
            ? content.text
            : content.type === "input_audio"
              ? content.transcript
              : null;
        if (text) {
          fastify.log.info(`Caller: ${text}`);
          evaluateStopRules(text);
        }
      }
    } else if (item.role === "assistant") {
      for (const content of item.content) {
        const text =
          content.type === "output_text"
            ? content.text
            : content.type === "output_audio"
              ? content.transcript
              : null;
        if (text) fastify.log.info(`Assistant: ${text}`);
      }
    }
  }

  async function observeCall(callId: string): Promise<void> {
    if (!openai || !OPENAI_API_KEY) return;

    const call = await getCallRuntime();
    const session = new RealtimeSession(call.agent, {
      transport: new OpenAIRealtimeSIP(),
      ...call.sessionOptions,
    });

    await updateCallLifecycle({
      openaiCallId: callId,
      event: "in_progress",
      summary: `voice=${call.assistant.voice} model=${call.assistant.model} src=${call.assistant.source}`,
    });

    session.on("history_added", (item: RealtimeItem) => logHistoryItem(item));
    session.on("agent_handoff", (_ctx, fromAgent, toAgent) => {
      fastify.log.info(`Handoff ${fromAgent.name} → ${toAgent.name}`);
    });
    session.on("error", (event) => {
      fastify.log.error({ err: event.error }, "Realtime session error");
    });

    try {
      await session.connect({ apiKey: OPENAI_API_KEY, callId });
      fastify.log.info(
        {
          callId,
          voice: call.assistant.voice,
          model: call.assistant.model,
          source: call.assistant.source,
        },
        `Attached to realtime call ${callId}`,
      );

      session.transport.sendEvent({
        type: "response.create",
        response: {
          instructions: `Say exactly '${call.welcome}' now before continuing the conversation.`,
        },
      });

      await new Promise<void>((resolve) => {
        const handleDisconnect = () => {
          session.transport.off("disconnected", handleDisconnect);
          resolve();
        };
        session.transport.on("disconnected", handleDisconnect);
      });
    } catch (error) {
      fastify.log.error({ err: error }, `Error observing call ${callId}`);
      await updateCallLifecycle({
        openaiCallId: callId,
        event: "failed",
        errorCode: "observe_error",
      });
    } finally {
      session.close();
      await updateCallLifecycle({
        openaiCallId: callId,
        event: "ended",
        outcome: "disconnected",
      });
      fastify.log.info(`Call ${callId} ended`);
    }
  }

  fastify.post("/openai/webhook", async (request, reply) => {
    if (!openai) {
      reply.status(503).send({ error: "OpenAI not configured" });
      return;
    }

    const rawBody = (request as unknown as { rawBody?: string | Buffer }).rawBody;
    const payload =
      typeof rawBody === "string" ? rawBody : rawBody?.toString("utf8");

    if (!payload) {
      reply.status(400).send({ error: "Missing raw body for webhook verification." });
      return;
    }

    let event: Awaited<ReturnType<typeof openai.webhooks.unwrap>>;
    try {
      event = await openai.webhooks.unwrap(payload, request.headers);
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        reply.status(400).send({ error: "Invalid webhook signature." });
        return;
      }
      fastify.log.error({ err: error }, "Failed to parse webhook");
      reply.status(500).send({ error: "Failed to parse webhook payload." });
      return;
    }

    if (event.type === "realtime.call.incoming") {
      const callId = event.data.call_id;
      const fromNumber =
        (event.data as { from?: string }).from ??
        (event.data as { sip_headers?: Array<{ name: string; value: string }> })
          .sip_headers?.find((h) => h.name.toLowerCase() === "from")?.value;

      const runtime = await loadTelephonyRuntime();
      if (runtime.pilotMode === "off") {
        fastify.log.warn(`Pilot off — rejecting call ${callId}`);
        await createCallRecord({
          openaiCallId: callId,
          fromNumber,
        });
        await updateCallLifecycle({
          openaiCallId: callId,
          event: "failed",
          errorCode: "pilot_off",
          outcome: "failed",
        });
        reply.status(200).send({ ok: true, accepted: false, reason: "pilot_off" });
        return;
      }

      const match = await lookupByPhone(fromNumber ?? null);
      await createCallRecord({
        openaiCallId: callId,
        fromNumber,
      });
      await updateCallLifecycle({
        openaiCallId: callId,
        event: "accepted",
        summary:
          match.status === "single"
            ? `CRM match: ${match.displayName ?? match.contactId}`
            : match.status === "ambiguous"
              ? "CRM ambiguous match"
              : "CRM unknown caller",
      });

      const call = await getCallRuntime();
      try {
        await acceptCall(callId, call.agent, call.sessionOptions);
      } catch (error) {
        fastify.log.error({ err: error }, `Failed to accept call ${callId}`);
        await updateCallLifecycle({
          openaiCallId: callId,
          event: "failed",
          errorCode: "accept_failed",
        });
        // Fallback policy
        if (runtime.fallbackPolicy.on_ai_failure === "create_callback_task") {
          fastify.log.info("Fallback: callback task recommended for accept_failed");
        }
        reply.status(500).send({ error: "Failed to accept call." });
        return;
      }

      if (!activeCallTasks.has(callId)) {
        const task = observeCall(callId)
          .catch((error) => {
            fastify.log.error({ err: error }, `Unhandled observe error ${callId}`);
          })
          .finally(() => {
            activeCallTasks.delete(callId);
          });
        activeCallTasks.set(callId, task);
      }
    }

    reply.status(200).send({ ok: true });
  });

  /**
   * Telnyx Call Control API v2 webhook.
   * Inbound DID → answer → transfer to OPENAI_SIP_URI → OpenAI fires /openai/webhook.
   * Path matches Mission Control: …/api/webhooks/telnyx
   */
  fastify.post("/api/webhooks/telnyx", async (request, reply) => {
    const parsed = parseTelnyxEvent(request.body);
    fastify.log.info(
      {
        eventType: parsed.eventType,
        callControlId: parsed.callControlId,
        from: parsed.from,
        to: parsed.to,
        direction: parsed.direction,
      },
      "Telnyx webhook",
    );

    if (!parsed.eventType) {
      reply.status(400).send({ error: "Missing event_type" });
      return;
    }

    // Always ACK quickly; work after for answer/transfer.
    if (
      parsed.eventType === "call.initiated" &&
      parsed.direction === "incoming" &&
      parsed.callControlId
    ) {
      const callControlId = parsed.callControlId;
      const runtime = await loadTelephonyRuntime();

      await createCallRecord({
        openaiCallId: `telnyx:${callControlId}`,
        fromNumber: parsed.from ?? undefined,
        toNumber: parsed.to ?? undefined,
      });

      if (runtime.pilotMode === "off") {
        fastify.log.warn(`Pilot off — rejecting Telnyx call ${callControlId}`);
        await updateCallLifecycle({
          openaiCallId: `telnyx:${callControlId}`,
          event: "failed",
          errorCode: "pilot_off",
          outcome: "failed",
        });
        reply.status(200).send({ ok: true, accepted: false, reason: "pilot_off" });
        return;
      }

      if (!telnyxReady) {
        reply.status(503).send({ error: "TELNYX_API_KEY not configured" });
        return;
      }

      if (!OPENAI_SIP_URI) {
        fastify.log.error("OPENAI_SIP_URI missing — cannot bridge to Realtime");
        await updateCallLifecycle({
          openaiCallId: `telnyx:${callControlId}`,
          event: "failed",
          errorCode: "missing_openai_sip_uri",
          outcome: "failed",
        });
        reply.status(200).send({
          ok: false,
          reason: "missing_openai_sip_uri",
        });
        return;
      }

      try {
        await answerCall(callControlId);
        await transferToSip(callControlId, OPENAI_SIP_URI, parsed.to ?? undefined);
        await updateCallLifecycle({
          openaiCallId: `telnyx:${callControlId}`,
          event: "accepted",
          summary: "Telnyx answered → transferred to OpenAI SIP",
        });
        reply.status(200).send({ ok: true, accepted: true });
      } catch (error) {
        fastify.log.error({ err: error }, `Telnyx answer/transfer failed ${callControlId}`);
        await updateCallLifecycle({
          openaiCallId: `telnyx:${callControlId}`,
          event: "failed",
          errorCode: "telnyx_bridge_failed",
          outcome: "failed",
        });
        reply.status(200).send({
          ok: false,
          reason: "telnyx_bridge_failed",
          message: error instanceof Error ? error.message : "unknown",
        });
      }
      return;
    }

    if (parsed.eventType === "call.hangup" && parsed.callControlId) {
      await updateCallLifecycle({
        openaiCallId: `telnyx:${parsed.callControlId}`,
        event: "ended",
        outcome: "disconnected",
        errorCode: parsed.hangupCause ?? undefined,
      });
    }

    reply.status(200).send({ ok: true });
  });

  /**
   * Twilio Programmable Voice webhook skeleton (legacy / fallback).
   * Production path is Telnyx → OpenAI SIP.
   */
  fastify.post("/twilio/voice", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;
    const from = body.From || body.from || "";
    const callSid = body.CallSid || body.call_sid || `twilio-${Date.now()}`;
    const to = body.To || body.to || "";

    fastify.log.info({ from, to, callSid }, "Twilio voice webhook");

    const runtime = await loadTelephonyRuntime();
    if (runtime.pilotMode === "off") {
      reply.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="de-DE">RegnerWerk ist derzeit nicht erreichbar. Bitte versuchen Sie es später erneut.</Say><Hangup/></Response>`);
      return;
    }

    await createCallRecord({
      openaiCallId: `twilio:${callSid}`,
      fromNumber: from,
      toNumber: to,
    });

    // Until SIP domain is configured: polite hold message (no recording).
    const sipUri = process.env.OPENAI_SIP_URI?.trim();
    if (sipUri) {
      reply.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>${sipUri}</Sip>
  </Dial>
</Response>`);
      return;
    }

    reply.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">Willkommen bei RegnerWerk. Die KI-Verbindung wird eingerichtet. Bitte konfigurieren Sie OPENAI_SIP_URI.</Say>
  <Pause length="2"/>
  <Hangup/>
</Response>`);
  });

  fastify.post("/twilio/status", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;
    const callSid = body.CallSid || "";
    const status = body.CallStatus || body.DialCallStatus || "";
    fastify.log.info({ callSid, status }, "Twilio status callback");
    if (callSid && (status === "completed" || status === "busy" || status === "failed" || status === "no-answer")) {
      await updateCallLifecycle({
        openaiCallId: `twilio:${callSid}`,
        event: status === "completed" ? "ended" : "failed",
        errorCode: status === "completed" ? undefined : status,
        outcome: status === "completed" ? "disconnected" : "failed",
      });
    }
    reply.status(200).send({ ok: true });
  });

  fastify.get("/transfer/resolve", async (request, reply) => {
    const reason =
      ((request.query as { reason?: string }).reason as string) || "human_request";
    const target = await selectTransferTarget(reason);
    reply.send({ reason, target });
  });

  const shutdown = async () => {
    try {
      await fastify.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.all([
    preloadStopRules().catch(() => {
      fastify.log.warn("Could not preload stop rules from admin — using local fallback");
    }),
    preloadTelephonyRuntime().catch(() => {
      fastify.log.warn("Could not preload telephony runtime — using env fallback");
    }),
  ]);

  await fastify.listen({ host: "0.0.0.0", port: PORT });
  fastify.log.info(`Voice Gateway listening on :${PORT}`);
}

main().catch((error) => {
  console.error("Failed to start Voice Gateway", error);
  process.exit(1);
});
