import fastifyFactory from "fastify";
import fastifyRawBody from "fastify-raw-body";
import formbody from "@fastify/formbody";
import dotenv from "dotenv";
import OpenAI from "openai";
import { InvalidWebhookSignatureError } from "openai/error";
import {
  OpenAIRealtimeSIP,
  RealtimeItem,
  RealtimeSession,
} from "@openai/agents/realtime";
import type { CallRuntime } from "./agents/reception.js";
import { createCallRecord, updateCallLifecycle } from "./modules/supabase.js";
import { lookupByPhone } from "./modules/crm-lookup.js";
import { evaluateStopRules, preloadStopRules } from "./modules/stop-rules.js";
import {
  loadTelephonyRuntime,
  preloadTelephonyRuntime,
} from "./modules/telephony-runtime.js";
import {
  getPreparedAccept,
  peekPreparedAccept,
  preloadCallRuntime,
  startCallRuntimeRefresh,
} from "./modules/runtime-cache.js";
import {
  acceptRealtimeCallRaw,
  warmOpenAiApi,
} from "./modules/fast-accept.js";
import { selectTransferTarget } from "./modules/transfer.js";
import {
  answerCall,
  hangupCall,
  openaiSipConfigured,
  parseTelnyxEvent,
  telnyxConfigured,
  transferToSip,
} from "./modules/telnyx.js";
import {
  takeInboundTelnyx,
  trackInboundTelnyx,
} from "./modules/telnyx-bridge.js";
import { loadPublishedAssistant } from "./modules/assistant.js";

dotenv.config();

const PORT = Number(process.env.PORT ?? 8000);
const VERSION = "0.4.6-voice-preview";

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
      routing: "call_control_transfer_openai_sip",
      webhookTelnyx: "/api/webhooks/telnyx",
      webhookOpenAI: "/openai/webhook",
      texmlInbound: "/texml/inbound",
      openaiSipUri: OPENAI_SIP_URI ? "configured" : null,
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

  /** Short German TTS sample for Admin Assistenten preview. */
  fastify.get("/preview/voice", async (request, reply) => {
    if (!OPENAI_API_KEY) {
      reply.status(503).send({ error: "OPENAI_API_KEY missing" });
      return;
    }
    const secret = process.env.VOICE_GATEWAY_SECRET?.trim();
    if (secret) {
      const auth = request.headers.authorization?.replace(/^Bearer\s+/i, "");
      const hdr = request.headers["x-voice-gateway-key"];
      if (auth !== secret && hdr !== secret) {
        reply.status(401).send({ error: "Unauthorized" });
        return;
      }
    }

    const allowed = new Set([
      "alloy",
      "ash",
      "ballad",
      "coral",
      "echo",
      "sage",
      "shimmer",
      "verse",
      "marin",
      "cedar",
    ]);
    const q = (request.query as { voice?: string }).voice?.trim() || "alloy";
    const voice = allowed.has(q) ? q : "alloy";
    const sample =
      "Guten Tag bei RegnerWerk. Ich helfe Ihnen gerne bei Bewässerung, Reparatur oder einer neuen Anlage.";

    try {
      let res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice,
          input: sample,
          response_format: "mp3",
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        // Fallback for older TTS voices
        res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1",
            voice: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].includes(
              voice,
            )
              ? voice
              : "alloy",
            input: sample,
            response_format: "mp3",
          }),
          signal: AbortSignal.timeout(20_000),
        });
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        reply.status(502).send({
          error: "TTS fehlgeschlagen",
          detail: errText.slice(0, 300),
        });
        return;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      reply
        .header("Content-Type", "audio/mpeg")
        .header("Cache-Control", "private, max-age=3600")
        .send(buf);
    } catch (error) {
      fastify.log.error({ err: error }, "voice preview failed");
      reply.status(500).send({ error: "Voice preview failed" });
    }
  });

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

  /** Accept ASAP with slim body (no tools/VAD) — full config via session after WS attach. */
  async function acceptCallFast(
    callId: string,
  ): Promise<"ok" | "gone" | "error"> {
    if (!OPENAI_API_KEY) return "error";
    const prepared =
      peekPreparedAccept() ?? (await getPreparedAccept());
    const result = await acceptRealtimeCallRaw(
      callId,
      prepared.slimBody,
      OPENAI_API_KEY,
    );
    if (result.ok) {
      fastify.log.info(
        { callId, acceptMs: result.ms },
        `Accepted call ${callId}`,
      );
      return "ok";
    }
    if (result.status === 404) {
      fastify.log.warn(
        { callId, acceptMs: result.ms, body: result.text },
        `Call ${callId} no longer exists when accepting`,
      );
      return "gone";
    }
    fastify.log.error(
      {
        callId,
        acceptMs: result.ms,
        status: result.status,
        body: result.text,
      },
      `Failed to accept call ${callId}`,
    );
    return "error";
  }

  async function hangupOpenAiCall(callId: string) {
    if (!openai) return;
    try {
      await openai.realtime.calls.hangup(callId);
      fastify.log.info({ callId }, "Hung up OpenAI call");
    } catch (error) {
      fastify.log.warn({ err: error, callId }, "OpenAI hangup failed");
    }
  }

  async function endCallBothLegs(callId: string, reason: string) {
    fastify.log.info({ callId, reason }, "Ending call (OpenAI + Telnyx)");
    await hangupOpenAiCall(callId);
    const inbound = takeInboundTelnyx(null);
    if (inbound) {
      await hangupCall(inbound).catch((err) =>
        fastify.log.warn({ err, inbound }, "Telnyx hangup failed"),
      );
    }
    void updateCallLifecycle({
      openaiCallId: callId,
      event: "ended",
      outcome: reason === "caller_goodbye" ? "completed" : "disconnected",
      summary: `end:${reason}`,
    });
  }

  function applyStopAction(
    callId: string,
    session: RealtimeSession,
    action: ReturnType<typeof evaluateStopRules>,
    ending: { done: boolean },
  ) {
    if (action.type === "none" || ending.done) return;
    if (action.type === "end_politely") {
      ending.done = true;
      try {
        session.transport.sendEvent({
          type: "response.create",
          response: {
            instructions:
              "Der Anrufer verabschiedet sich. Sage kurz und freundlich auf Deutsch nur: 'Alles klar, schönen Tag noch. Tschüss!' Keine Fragen.",
          },
        });
      } catch {
        /* session may already be closing */
      }
      setTimeout(() => {
        void endCallBothLegs(callId, action.reason);
      }, 2500);
      return;
    }
    if (action.type === "transfer_human" || action.type === "mark_urgent") {
      fastify.log.info({ callId, action }, "Stop rule needs human/urgent — flag only");
      void updateCallLifecycle({
        openaiCallId: callId,
        event: "in_progress",
        summary: `${action.type}:${action.reason}`,
      });
    }
  }

  function handleCallerText(
    callId: string,
    session: RealtimeSession,
    text: string,
    ending: { done: boolean },
  ) {
    const trimmed = text.trim();
    if (!trimmed) return;
    fastify.log.info(`Caller: ${trimmed}`);
    const action = evaluateStopRules(trimmed);
    applyStopAction(callId, session, action, ending);
  }

  async function observeCall(
    callId: string,
    runtime: CallRuntime,
  ): Promise<void> {
    if (!openai || !OPENAI_API_KEY) return;

    const session = new RealtimeSession(runtime.agent, {
      transport: new OpenAIRealtimeSIP(),
      ...runtime.sessionOptions,
    });
    const ending = { done: false };

    session.on("history_added", (item: RealtimeItem) => {
      if (item.type !== "message") return;
      if (item.role === "user") {
        for (const content of item.content) {
          const text =
            content.type === "input_text"
              ? content.text
              : content.type === "input_audio"
                ? content.transcript
                : null;
          if (text) handleCallerText(callId, session, text, ending);
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
    });
    session.on("agent_handoff", (_ctx, fromAgent, toAgent) => {
      fastify.log.info(`Handoff ${fromAgent.name} → ${toAgent.name}`);
    });
    session.on("error", (event) => {
      fastify.log.error({ err: event.error }, "Realtime session error");
    });
    // Catch transcripts that arrive as transport events (not only history_added).
    session.on("transport_event", (event: { type?: string; transcript?: string }) => {
      if (
        event?.type === "conversation.item.input_audio_transcription.completed" &&
        typeof event.transcript === "string"
      ) {
        handleCallerText(callId, session, event.transcript, ending);
      }
    });

    try {
      // Attach WS immediately — do not await CRM/lifecycle before connect.
      await session.connect({ apiKey: OPENAI_API_KEY, callId });
      fastify.log.info(
        {
          callId,
          voice: runtime.assistant.voice,
          model: runtime.assistant.model,
          source: runtime.assistant.source,
        },
        `Attached to realtime call ${callId}`,
      );

      void updateCallLifecycle({
        openaiCallId: callId,
        event: "in_progress",
        summary: `voice=${runtime.assistant.voice} model=${runtime.assistant.model} src=${runtime.assistant.source}`,
      });

      session.transport.sendEvent({
        type: "response.create",
        response: {
          instructions: `Say exactly '${runtime.welcome}' now before continuing the conversation.`,
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
      if (!ending.done) {
        await updateCallLifecycle({
          openaiCallId: callId,
          event: "ended",
          outcome: "disconnected",
        });
      }
      fastify.log.info(`Call ${callId} ended`);
    }
  }

  async function ingestCallSideEffects(
    callId: string,
    fromNumber: string | undefined,
  ) {
    const match = await lookupByPhone(fromNumber ?? null).catch(() => null);
    await createCallRecord({
      openaiCallId: callId,
      fromNumber,
    }).catch((err) =>
      fastify.log.warn({ err }, "createCallRecord after accept failed"),
    );
    await updateCallLifecycle({
      openaiCallId: callId,
      event: "accepted",
      summary:
        match?.status === "single"
          ? `CRM match: ${match.displayName ?? match.contactId}`
          : match?.status === "ambiguous"
            ? "CRM ambiguous match"
            : "CRM unknown caller",
    }).catch((err) =>
      fastify.log.warn({ err }, "updateCallLifecycle after accept failed"),
    );
  }

  fastify.post("/openai/webhook", async (request, reply) => {
    if (!openai || !OPENAI_API_KEY) {
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

    // Start accept ASAP (before signature unwrap) — invite dies in seconds.
    // call_id is useless without a real OpenAI invite; forged IDs just 404.
    let earlyCallId: string | null = null;
    let earlyAccept: ReturnType<typeof acceptCallFast> | null = null;
    try {
      const rough = JSON.parse(payload) as {
        type?: string;
        data?: { call_id?: string };
      };
      if (rough.type === "realtime.call.incoming" && rough.data?.call_id) {
        earlyCallId = rough.data.call_id;
        earlyAccept = acceptCallFast(earlyCallId);
      }
    } catch {
      /* verified path below */
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
      const webhookReceivedAt = Date.now();
      const callId = event.data.call_id;
      const fromNumber =
        (event.data as { from?: string }).from ??
        (event.data as { sip_headers?: Array<{ name: string; value: string }> })
          .sip_headers?.find((h) => h.name.toLowerCase() === "from")?.value;

      const runtimeTelephony = await loadTelephonyRuntime();
      if (runtimeTelephony.pilotMode === "off") {
        fastify.log.warn(`Pilot off — rejecting call ${callId}`);
        void hangupOpenAiCall(callId);
        void createCallRecord({ openaiCallId: callId, fromNumber });
        void updateCallLifecycle({
          openaiCallId: callId,
          event: "failed",
          errorCode: "pilot_off",
          outcome: "failed",
        });
        reply.status(200).send({ ok: true, accepted: false, reason: "pilot_off" });
        return;
      }

      const acceptResult =
        earlyAccept && earlyCallId === callId
          ? await earlyAccept
          : await acceptCallFast(callId);
      const prepared = peekPreparedAccept() ?? (await getPreparedAccept());

      if (acceptResult !== "ok") {
        void hangupOpenAiCall(callId);
        void createCallRecord({ openaiCallId: callId, fromNumber });
        void updateCallLifecycle({
          openaiCallId: callId,
          event: "failed",
          errorCode: acceptResult === "gone" ? "accept_gone" : "accept_failed",
          outcome: "failed",
        });
        if (runtimeTelephony.fallbackPolicy.on_ai_failure === "create_callback_task") {
          fastify.log.info("Fallback: callback task recommended for accept_failed");
        }
        reply.status(200).send({
          ok: false,
          accepted: false,
          reason: acceptResult,
          webhookToAcceptMs: Date.now() - webhookReceivedAt,
        });
        return;
      }

      // Hold the Realtime session: attach sideband WS immediately after accept.
      // (Media rides on SIP; WS keeps control + tools + welcome alive.)
      if (!activeCallTasks.has(callId)) {
        const task = observeCall(callId, prepared.runtime)
          .catch((error) => {
            fastify.log.error({ err: error }, `Unhandled observe error ${callId}`);
          })
          .finally(() => {
            activeCallTasks.delete(callId);
          });
        activeCallTasks.set(callId, task);
      }

      reply.status(200).send({
        ok: true,
        accepted: true,
        webhookToAcceptMs: Date.now() - webhookReceivedAt,
      });

      void ingestCallSideEffects(callId, fromNumber);
      return;
    }

    reply.status(200).send({ ok: true });
  });

  /**
   * Proven routing (Twilio Elastic SIP / Wavix / OpenAI docs):
   * DID → TeXML Dial &lt;Sip&gt; → OpenAI Realtime SIP → /openai/webhook accept.
   * No Call Control answer+transfer hop.
   */
  function openaiSipTexml(): string {
    const sip = OPENAI_SIP_URI || "";
    const safe = sip
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // answerOnBridge=false: answer PSTN quickly; OpenAI accept must still succeed for audio.
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="45">
    <Sip>${safe}</Sip>
  </Dial>
</Response>`;
  }

  fastify.get("/texml/inbound", async (_request, reply) => {
    const runtime = await loadTelephonyRuntime();
    if (runtime.pilotMode === "off") {
      reply.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">RegnerWerk ist derzeit nicht erreichbar. Bitte versuchen Sie es spaeter erneut.</Say>
  <Hangup/>
</Response>`);
      return;
    }
    if (!OPENAI_SIP_URI) {
      fastify.log.error("OPENAI_SIP_URI missing for TeXML Dial");
      reply.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`);
      return;
    }
    fastify.log.info({ sip: OPENAI_SIP_URI }, "TeXML inbound → Dial OpenAI SIP");
    reply.type("text/xml").send(openaiSipTexml());
  });

  fastify.post("/texml/inbound", async (_request, reply) => {
    const runtime = await loadTelephonyRuntime();
    if (runtime.pilotMode === "off") {
      reply.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">RegnerWerk ist derzeit nicht erreichbar. Bitte versuchen Sie es spaeter erneut.</Say>
  <Hangup/>
</Response>`);
      return;
    }
    if (!OPENAI_SIP_URI) {
      reply.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`);
      return;
    }
    fastify.log.info({ sip: OPENAI_SIP_URI }, "TeXML inbound POST → Dial OpenAI SIP");
    reply.type("text/xml").send(openaiSipTexml());
  });

  fastify.post("/texml/status", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;
    fastify.log.info(
      {
        callSid: body.CallSid || body.CallSidLegacy,
        callStatus: body.CallStatus || body.DialCallStatus,
        from: body.From,
        to: body.To,
      },
      "TeXML status",
    );
    reply.status(200).send({ ok: true });
  });

  /**
   * Production: Call Control answer → transfer to OpenAI SIP.
   * (TeXML Dial answered SIP but hung up before media/WS — keep as fallback /texml.)
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
      "Telnyx Call Control webhook",
    );

    if (
      parsed.eventType === "call.initiated" &&
      parsed.direction === "incoming" &&
      parsed.callControlId
    ) {
      const callControlId = parsed.callControlId;
      trackInboundTelnyx({ callControlId, from: parsed.from });
      reply.status(200).send({ ok: true, accepted: true, deferred: true });

      void (async () => {
        try {
          const runtime = await loadTelephonyRuntime();
          if (runtime.pilotMode === "off") {
            await hangupCall(callControlId).catch(() => undefined);
            return;
          }
          if (!telnyxReady || !OPENAI_SIP_URI) {
            await hangupCall(callControlId).catch(() => undefined);
            return;
          }
          await answerCall(callControlId);
          await transferToSip(
            callControlId,
            OPENAI_SIP_URI,
            parsed.to ?? undefined,
          );
          fastify.log.info({ callControlId }, "Telnyx bridged to OpenAI SIP");
        } catch (error) {
          fastify.log.error(
            { err: error },
            `Telnyx answer/transfer failed ${callControlId}`,
          );
          await hangupCall(callControlId).catch(() => undefined);
        }
      })();
      return;
    }

    // OpenAI SIP leg died → don't leave PSTN in silence.
    if (
      parsed.eventType === "call.hangup" &&
      (parsed.to?.includes("sip.api.openai.com") ||
        parsed.to?.includes("sip-eu.api.openai.com"))
    ) {
      const inbound = takeInboundTelnyx(null);
      if (inbound && inbound !== parsed.callControlId) {
        void hangupCall(inbound).catch(() => undefined);
        fastify.log.warn(
          { inbound, openaiLeg: parsed.callControlId },
          "OpenAI SIP hung up — ending inbound PSTN to avoid silence",
        );
      }
    }

    reply.status(200).send({ ok: true });
  });

  /**
   * Twilio Programmable Voice webhook skeleton (legacy / unused).
   */
  fastify.post("/twilio/voice", async (request, reply) => {
    const runtime = await loadTelephonyRuntime();
    if (runtime.pilotMode === "off" || !OPENAI_SIP_URI) {
      reply.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`);
      return;
    }
    reply.type("text/xml").send(openaiSipTexml());
  });

  fastify.post("/twilio/status", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;
    fastify.log.info(
      { callSid: body.CallSid, status: body.CallStatus },
      "Twilio status callback",
    );
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
    preloadCallRuntime().catch((err) => {
      fastify.log.warn({ err }, "Could not preload call runtime — will build on first call");
    }),
    OPENAI_API_KEY
      ? warmOpenAiApi(OPENAI_API_KEY).catch(() => undefined)
      : Promise.resolve(),
  ]);
  startCallRuntimeRefresh();

  await fastify.listen({ host: "0.0.0.0", port: PORT });
  fastify.log.info(`Voice Gateway listening on :${PORT} (${VERSION})`);
}

main().catch((error) => {
  console.error("Failed to start Voice Gateway", error);
  process.exit(1);
});
