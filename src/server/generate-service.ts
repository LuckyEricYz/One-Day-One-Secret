import type {
  GenerateErrorResponse,
  GenerateRequestPayload,
  GenerateSuccessResponse,
  TianjiData
} from "../types";
import { MAX_DAILY_QUOTA, SHANGHAI_TIMEZONE, getNextShanghaiMidnightIso, getShanghaiDateKey } from "../shared/time";
import { getCalendarContext } from "./calendar";
import { buildFallbackResult } from "./fallback";
import { getHexagramContext } from "./hexagrams";
import { retrieveKnowledge } from "./knowledge";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { generateWithProviders } from "./providers";
import { isValidRequestBody, normalizeGeneratedData } from "./validate";

const runtimeQuota = new Map<string, { date: string; count: number }>();

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

export async function generateTianji(
  body: unknown,
  env: Record<string, string | undefined> = process.env
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

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(calendar, hexagram, payload.userProfile, knowledgeEntries);

  let result: TianjiData | null = null;

  try {
    const providerResult = await generateWithProviders(env.AI_PROVIDER, {
      openAiApiKey: env.OPENAI_API_KEY,
      openAiModel: env.OPENAI_MODEL,
      geminiApiKey: env.GEMINI_API_KEY,
      geminiModel: env.GEMINI_MODEL
    }, systemPrompt, userPrompt);

    const normalized = normalizeGeneratedData(providerResult.payload);
    if (!normalized) {
      throw new Error("Model output validation failed.");
    }

    result = {
      ...normalized,
      meta: {
        solarTermName: calendar.solarTermName,
        ganZhiSummary: calendar.ganZhiSummary,
        hexagramName: hexagram.name,
        knowledgeIds: knowledgeEntries.map((entry) => entry.id),
        generatedAt: new Date().toISOString(),
        provider: providerResult.provider,
        isFallback: false
      }
    };
  } catch {
    result = buildFallbackResult(
      calendar,
      hexagram,
      knowledgeEntries,
      payload.userProfile.todayMood
    );
  }

  const remainingQuota = incrementQuota(payload.clientId, payload.context.timestamp);
  return {
    success: true,
    data: result,
    remainingQuota
  };
}

