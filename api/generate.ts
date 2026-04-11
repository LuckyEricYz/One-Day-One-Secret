import { randomUUID } from "node:crypto";

import { generateTianji } from "../src/server/generate-service";

type GenerateResult = Awaited<ReturnType<typeof generateTianji>>;

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

export default async function handler(request: Request): Promise<Response> {
  // Support both standard Request (from Edge/modern Node) and fallback to method check
  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Only POST is allowed."
        }
      }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.warn(
      `[api/generate:${requestId}] invalid-json ${JSON.stringify({
        contentType: request.headers.get("content-type") ?? "unknown",
        error: error instanceof Error ? error.message : String(error)
      })}`
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Request body must be valid JSON."
        }
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
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

    return new Response(JSON.stringify(result), {
      status,
      headers: { "Content-Type": "application/json" }
    });
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

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: `生成服务发生未处理异常: ${errorDetails.message || "未知错误"}`
        }
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
