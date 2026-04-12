import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { generateTianji } from "../src/server/generate-service.js";

type GenerateResult = Awaited<ReturnType<typeof generateTianji>>;
type NodeRequest = IncomingMessage & { body?: unknown };
type HandlerRequest = Request | NodeRequest;

function getResponseStatus(result: GenerateResult): number {
  if (result.success) {
    return 200;
  }

  if (result.error.code === "RATE_LIMIT_EXCEEDED") {
    return 429;
  }

  if (result.error.code === "INVALID_INPUT" || result.error.code === "PRESS_TOO_SHORT") {
    return 400;
  }

  return 500;
}

function toBaseUrlHost(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).host;
  } catch {
    return "invalid";
  }
}

function summarizeRequestBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return { bodyType: typeof body };
  }

  const payload = body as Record<string, unknown>;
  const userProfile =
    payload.userProfile && typeof payload.userProfile === "object"
      ? (payload.userProfile as Record<string, unknown>)
      : null;
  const dailySupplement =
    payload.dailySupplement && typeof payload.dailySupplement === "object"
      ? (payload.dailySupplement as Record<string, unknown>)
      : null;
  const context =
    payload.context && typeof payload.context === "object"
      ? (payload.context as Record<string, unknown>)
      : null;

  return {
    clientIdPrefix:
      typeof payload.clientId === "string" ? payload.clientId.slice(0, 8) : undefined,
    pressDurationMs:
      typeof payload.pressDurationMs === "number" ? payload.pressDurationMs : undefined,
    touchEntropyPresent: typeof payload.touchEntropy === "number",
    constitution:
      typeof userProfile?.constitution === "string" ? userProfile.constitution : undefined,
    todayMood: typeof userProfile?.todayMood === "string" ? userProfile.todayMood : undefined,
    healthTagCount: Array.isArray(userProfile?.healthTags) ? userProfile.healthTags.length : undefined,
    supplementHeadSense:
      typeof dailySupplement?.headSense === "string" ? dailySupplement.headSense : undefined,
    supplementSleepDuration:
      typeof dailySupplement?.sleepDuration === "string" ? dailySupplement.sleepDuration : undefined,
    supplementTongueCoating:
      typeof dailySupplement?.tongueCoating === "string" ? dailySupplement.tongueCoating : undefined,
    timestamp: typeof context?.timestamp === "number" ? context.timestamp : undefined,
    timezone: typeof context?.timezone === "string" ? context.timezone : undefined,
    hasLocation: Boolean(context?.location)
  };
}

function summarizeEnv(env: Record<string, string | undefined>) {
  return {
    nodeEnv: env.NODE_ENV ?? "unknown",
    vercelEnv: env.VERCEL_ENV ?? "unknown",
    vercelRegion: env.VERCEL_REGION ?? "unknown",
    aiProvider: env.AI_PROVIDER ?? "auto",
    hasOpenAiApiKey: Boolean(env.OPENAI_API_KEY),
    openAiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    openAiBaseHost: toBaseUrlHost(env.OPENAI_BASE_URL),
    hasGeminiApiKey: Boolean(env.GEMINI_API_KEY),
    geminiModel: env.GEMINI_MODEL ?? "gemini-2.5-flash",
    hasKimiApiKey: Boolean(env.KIMI_API_KEY),
    kimiModel: env.KIMI_MODEL ?? "kimi-for-coding",
    kimiBaseHost: toBaseUrlHost(env.KIMI_BASE_URL)
  };
}

function summarizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 6).join("\n")
    };
  }

  return {
    value: String(error)
  };
}

function isWebRequest(request: HandlerRequest): request is Request {
  return typeof (request as Request).json === "function" && typeof (request as Request).headers?.get === "function";
}

function getMethod(request: HandlerRequest): string {
  return request.method?.toUpperCase() ?? "GET";
}

function getHeader(request: HandlerRequest, name: string): string | undefined {
  if (isWebRequest(request)) {
    return request.headers.get(name) ?? undefined;
  }

  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

async function readNodeRequestText(request: NodeRequest): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parseKnownNodeBody(body: unknown): unknown {
  if (body == null) {
    return null;
  }

  if (typeof body === "string") {
    return body.length > 0 ? JSON.parse(body) : null;
  }

  if (Buffer.isBuffer(body)) {
    const rawBody = body.toString("utf8");
    return rawBody.length > 0 ? JSON.parse(rawBody) : null;
  }

  return body;
}

async function parseRequestBody(request: HandlerRequest): Promise<unknown> {
  if (isWebRequest(request)) {
    return request.json();
  }

  if ("body" in request && request.body !== undefined) {
    return parseKnownNodeBody(request.body);
  }

  const rawBody = await readNodeRequestText(request);
  return rawBody.length > 0 ? JSON.parse(rawBody) : null;
}

function createJsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function sendJsonResponse(
  payload: unknown,
  status: number,
  response?: ServerResponse
): Response | void {
  if (!response) {
    return createJsonResponse(payload, status);
  }

  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

export default async function handler(
  request: HandlerRequest,
  response?: ServerResponse
): Promise<Response | void> {
  if (getMethod(request) !== "POST") {
    return sendJsonResponse(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Only POST is allowed."
        }
      },
      405,
      response
    );
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  let body: unknown;

  try {
    body = await parseRequestBody(request);
  } catch (error) {
    console.warn(
      `[api/generate:${requestId}] invalid-json ${JSON.stringify({
        contentType: getHeader(request, "content-type") ?? "unknown",
        error: error instanceof Error ? error.message : String(error)
      })}`
    );

    return sendJsonResponse(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Request body must be valid JSON."
        }
      },
      400,
      response
    );
  }

  try {
    const envSummary = summarizeEnv(process.env);
    console.info(
      `[api/generate:${requestId}] request ${JSON.stringify({
        body: summarizeRequestBody(body),
        env: envSummary
      })}`
    );

    // Check if at least one API key is present
    if (!envSummary.hasOpenAiApiKey && !envSummary.hasGeminiApiKey && !envSummary.hasKimiApiKey) {
      console.warn(`[api/generate:${requestId}] no-api-keys-warning: AI_PROVIDER=${process.env.AI_PROVIDER}`);
    }

    const result = await generateTianji(body, process.env, requestId);
    const status = getResponseStatus(result);

    console.info(
      `[api/generate:${requestId}] response ${JSON.stringify({
        status,
        success: result.success,
        durationMs: Date.now() - startedAt,
        errorCode: result.success ? undefined : result.error.code,
        provider: result.success ? result.data.meta.provider : undefined,
        isFallback: result.success ? result.data.meta.isFallback : undefined,
        fallbackReasonCode: result.success ? result.data.meta.fallbackReasonCode : undefined,
        remainingQuota: result.success ? result.remainingQuota : undefined
      })}`
    );

    return sendJsonResponse(result, status, response);
  } catch (error) {
    const errorDetails = summarizeError(error);
    console.error(
      `[api/generate:${requestId}] unexpected-error ${JSON.stringify({
        durationMs: Date.now() - startedAt,
        body: summarizeRequestBody(body),
        env: summarizeEnv(process.env),
        error: errorDetails
      })}`
    );

    return sendJsonResponse(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: `生成服务发生未处理异常: ${errorDetails.message || "未知错误"}`
        }
      },
      500,
      response
    );
  }
}
