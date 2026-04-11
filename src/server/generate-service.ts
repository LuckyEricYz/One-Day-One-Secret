import { randomUUID } from "node:crypto";

import type {
  GenerateErrorResponse,
  GenerateRequestPayload,
  GenerateSuccessResponse,
  TianjiData,
  TianjiMeta
} from "../types";
import {
  MAX_DAILY_QUOTA,
  SHANGHAI_TIMEZONE,
  getNextShanghaiMidnightIso,
  getShanghaiDateKey
} from "../shared/time";
import { getCalendarContext } from "./calendar";
import { buildFallbackResult } from "./fallback";
import { getHexagramContext } from "./hexagrams";
import { retrieveKnowledge } from "./knowledge";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import {
  type ProviderAttemptLog,
  type ProviderConfig,
  type ProviderErrorType,
  callProvider,
  getProviderOrder,
  toAttemptLog,
  toProviderError
} from "./providers";
import type { ServerEnv } from "./env";
import { isValidRequestBody, normalizeGeneratedData } from "./validate";

const runtimeQuota = new Map<string, { date: string; count: number }>();
const SCHEMA_RETRY_LIMIT = 2;

function errorResponse(
  code: GenerateErrorResponse["error"]["code"],
  message: string,
  retryAfter?: string
): GenerateErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      retryAfter
    }
  };
}

function getQuotaState(clientId: string, timestamp: number) {
  const date = getShanghaiDateKey(timestamp);
  const existing = runtimeQuota.get(clientId);

  if (!existing || existing.date !== date) {
    const fresh = { date, count: 0 };
    runtimeQuota.set(clientId, fresh);
    return fresh;
  }

  return existing;
}

function incrementQuota(clientId: string, timestamp: number): number {
  const state = getQuotaState(clientId, timestamp);
  state.count += 1;
  runtimeQuota.set(clientId, state);
  return Math.max(0, MAX_DAILY_QUOTA - state.count);
}

function getProviderConfig(env: ServerEnv): ProviderConfig {
  return {
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL,
    openAiBaseUrl: env.OPENAI_BASE_URL,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL
  };
}

function getFallbackReasonCode(attempts: ProviderAttemptLog[]): TianjiMeta["fallbackReasonCode"] {
  if (attempts.length === 0) {
    return "provider_unavailable";
  }

  const actionableAttempt = [...attempts]
    .reverse()
    .find((attempt) => attempt.errorType && attempt.errorType !== "provider_unavailable");

  return actionableAttempt?.errorType ?? attempts[attempts.length - 1].errorType ?? "provider_unavailable";
}

function appendRequestMeta(
  data: TianjiData,
  requestId: string,
  fallbackReasonCode?: TianjiMeta["fallbackReasonCode"]
): TianjiData {
  return {
    ...data,
    meta: {
      ...data.meta,
      requestId,
      fallbackReasonCode
    }
  };
}

function buildSuccessResult(
  normalized: Omit<TianjiData, "meta">,
  requestId: string,
  provider: TianjiMeta["provider"],
  calendar: ReturnType<typeof getCalendarContext>,
  hexagram: ReturnType<typeof getHexagramContext>,
  knowledgeIds: string[]
): TianjiData {
  return {
    ...normalized,
    meta: {
      solarTermName: calendar.solarTermName,
      ganZhiSummary: calendar.ganZhiSummary,
      hexagramName: hexagram.name,
      knowledgeIds,
      generatedAt: new Date().toISOString(),
      provider,
      isFallback: false,
      requestId
    }
  };
}

function summarizeAttempts(attempts: ProviderAttemptLog[]): string {
  if (attempts.length === 0) {
    return "no provider attempts";
  }

  return attempts
    .map((attempt) => {
      const parts = [
        attempt.provider,
        attempt.model,
        `${attempt.latencyMs}ms`,
        attempt.status
      ];

      if (attempt.statusCode) {
        parts.push(`http:${attempt.statusCode}`);
      }

      if (attempt.errorType) {
        parts.push(`type:${attempt.errorType}`);
      }

      if (attempt.errorSummary) {
        parts.push(`reason:${attempt.errorSummary}`);
      }

      return parts.join(" ");
    })
    .join(" | ");
}

function logProviderOutcome(
  requestId: string,
  attempts: ProviderAttemptLog[],
  finalProvider: TianjiMeta["provider"],
  fallbackReasonCode?: TianjiMeta["fallbackReasonCode"]
) {
  const summary = summarizeAttempts(attempts);
  const prefix = `[generate:${requestId}]`;

  if (process.env.NODE_ENV === "production") {
    if (finalProvider === "fallback") {
      console.warn(`${prefix} provider=fallback reason=${fallbackReasonCode ?? "unknown"}`);
      return;
    }

    console.info(`${prefix} provider=${finalProvider}`);
    return;
  }

  const suffix =
    finalProvider === "fallback"
      ? `provider=fallback reason=${fallbackReasonCode ?? "unknown"}`
      : `provider=${finalProvider}`;

  console.info(`${prefix} ${suffix} ${summary}`);
}

export async function generateTianji(
  body: unknown,
  env: ServerEnv = process.env
): Promise<GenerateSuccessResponse | GenerateErrorResponse> {
  if (!isValidRequestBody(body)) {
    return errorResponse("INVALID_INPUT", "输入结构或枚举值不合法。");
  }

  const payload = body as GenerateRequestPayload;

  if (payload.context.timezone !== SHANGHAI_TIMEZONE) {
    return errorResponse("INVALID_INPUT", "仅支持 Asia/Shanghai 时区。");
  }

  if (!Number.isInteger(payload.pressDurationMs) || payload.pressDurationMs < 2000) {
    return errorResponse("PRESS_TOO_SHORT", "请再静心一会儿。");
  }

  if (payload.pressDurationMs > 30000) {
    return errorResponse("INVALID_INPUT", "长按时间超出允许范围。");
  }

  const quota = getQuotaState(payload.clientId, payload.context.timestamp);
  if (quota.count >= MAX_DAILY_QUOTA) {
    return errorResponse(
      "RATE_LIMIT_EXCEEDED",
      "今日天机已满，请明日再来。",
      getNextShanghaiMidnightIso(payload.context.timestamp)
    );
  }

  const requestId = randomUUID();
  const calendar = getCalendarContext(payload.context.timestamp);
  const hexagram = getHexagramContext(
    payload.pressDurationMs,
    payload.context.timestamp,
    payload.touchEntropy ?? 0
  );
  const knowledgeEntries = retrieveKnowledge({
    solarTermKey: calendar.solarTermKey,
    constitution: payload.userProfile.constitution,
    mood: payload.userProfile.todayMood,
    healthTags: payload.userProfile.healthTags
  });
  const knowledgeIds = knowledgeEntries.map((entry) => entry.id);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(calendar, hexagram, payload.userProfile, knowledgeEntries);
  const providerConfig = getProviderConfig(env);
  const providerOrder = getProviderOrder(env.AI_PROVIDER);
  const attempts: ProviderAttemptLog[] = [];

  for (const provider of providerOrder) {
    let retryCount = 0;

    while (retryCount < SCHEMA_RETRY_LIMIT) {
      try {
        const providerResult = await callProvider(
          provider,
          providerConfig,
          systemPrompt,
          userPrompt
        );
        const normalized = normalizeGeneratedData(providerResult.payload);

        if (!normalized) {
          attempts.push({
            provider: providerResult.provider,
            model: providerResult.model,
            latencyMs: providerResult.latencyMs,
            status: "error",
            statusCode: providerResult.statusCode,
            errorType: "schema",
            errorSummary: "Model output did not match TianjiData."
          });

          retryCount += 1;
          if (retryCount < SCHEMA_RETRY_LIMIT) {
            continue;
          }
          break;
        }

        attempts.push({
          provider: providerResult.provider,
          model: providerResult.model,
          latencyMs: providerResult.latencyMs,
          status: "success",
          statusCode: providerResult.statusCode
        });

        const result = buildSuccessResult(
          normalized,
          requestId,
          providerResult.provider,
          calendar,
          hexagram,
          knowledgeIds
        );
        logProviderOutcome(requestId, attempts, providerResult.provider);

        const remainingQuota = incrementQuota(payload.clientId, payload.context.timestamp);
        return {
          success: true,
          data: result,
          remainingQuota
        };
      } catch (error) {
        const providerError = toProviderError(error);
        attempts.push(toAttemptLog(providerError));

        if (
          (providerError.errorType === "parse" || providerError.errorType === "schema") &&
          retryCount + 1 < SCHEMA_RETRY_LIMIT
        ) {
          retryCount += 1;
          continue;
        }

        break;
      }
    }
  }

  const fallbackReasonCode = getFallbackReasonCode(attempts);
  const fallback = appendRequestMeta(
    buildFallbackResult(calendar, hexagram, knowledgeEntries, payload.userProfile.todayMood),
    requestId,
    fallbackReasonCode
  );

  logProviderOutcome(requestId, attempts, "fallback", fallbackReasonCode);

  const remainingQuota = incrementQuota(payload.clientId, payload.context.timestamp);
  return {
    success: true,
    data: fallback,
    remainingQuota
  };
}
