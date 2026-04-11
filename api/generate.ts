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

export async function GET(): Promise<Response> {
  return Response.json(
    {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Only POST is allowed."
      }
    },
    { status: 405 }
  );
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    console.warn(
      `[api/generate:${requestId}] invalid-json ${JSON.stringify({
        contentType: request.headers.get("content-type") ?? "unknown"
      })}`
    );

    return Response.json(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Request body must be valid JSON."
        }
      },
      { status: 400 }
    );
  }

  try {
    console.info(
      `[api/generate:${requestId}] request ${JSON.stringify({
        body: summarizeRequestBody(body),
        env: summarizeEnv(process.env)
      })}`
    );

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

    return Response.json(result, { status });
  } catch (error) {
    console.error(
      `[api/generate:${requestId}] unexpected-error ${JSON.stringify({
        durationMs: Date.now() - startedAt,
        body: summarizeRequestBody(body),
        env: summarizeEnv(process.env),
        error: summarizeError(error)
      })}`
    );

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "生成服务发生未处理异常。"
        }
      },
      { status: 500 }
    );
  }
}
