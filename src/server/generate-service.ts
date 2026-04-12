import { randomUUID } from "node:crypto";

import type {
  GenerateErrorResponse,
  GenerateRequestPayload,
  GenerateSuccessResponse,
  TianjiData,
  TianjiMeta
} from "../types.js";
import {
  MAX_DAILY_QUOTA,
  SHANGHAI_TIMEZONE,
  getNextShanghaiMidnightIso,
  getShanghaiDateKey
} from "../shared/time.js";
import { buildPreviewCue } from "../shared/ritual.js";
import { getCalendarContext } from "./calendar.js";
import { buildFallbackResult } from "./fallback.js";
import { getHexagramContext } from "./hexagrams.js";
import { selectKnowledge } from "./knowledge.js";
import { KNOWLEDGE_EMBEDDING_INDEX } from "./knowledge-index.generated.js";
import { buildRepairUserPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import {
  type ProviderAttemptLog,
  type ProviderConfig,
  type ProviderName,
  callProvider,
  getProviderOrder,
  toAttemptLog,
  toProviderError
} from "./providers.js";
import {
  type GenerationQualityReport,
  evaluateGenerationQuality,
  summarizeQualityIssues
} from "./quality.js";
import {
  buildKnowledgeQueryText,
  buildQueryVector,
  getRetrievalMode,
  isKnowledgeEmbeddingIndexUsable
} from "./rag.js";
import type { ServerEnv } from "./env.js";
import { isValidRequestBody, normalizeGeneratedData } from "./validate.js";

const runtimeQuota = new Map<string, { date: string; count: number }>();
const GENERATION_ATTEMPT_LIMIT = 2;

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
    kimiApiKey: env.KIMI_API_KEY,
    kimiModel: env.KIMI_MODEL,
    kimiBaseUrl: env.KIMI_BASE_URL,
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

      if (attempt.providerRequestId) {
        parts.push(`req:${attempt.providerRequestId}`);
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
  const suffix =
    finalProvider === "fallback"
      ? `provider=fallback reason=${fallbackReasonCode ?? "unknown"}`
      : `provider=${finalProvider}`;

  if (finalProvider === "fallback") {
    console.warn(`${prefix} ${suffix} ${summary}`);
    return;
  }

  console.info(`${prefix} ${suffix} ${summary}`);
}

function summarizeConfiguredProviders(env: ServerEnv, providerOrder: ProviderName[]): string {
  const availableProviders = [
    env.OPENAI_API_KEY ? "openai" : null,
    env.GEMINI_API_KEY ? "gemini" : null,
    env.KIMI_API_KEY ? "kimi" : null
  ]
    .filter((value): value is ProviderName => value !== null)
    .join(",") || "none";

  return `requested=${env.AI_PROVIDER ?? "auto"} order=${
    providerOrder.join(",") || "fallback-only"
  } configured=${availableProviders}`;
}

async function prepareKnowledgeSelection(
  payload: GenerateRequestPayload,
  calendar: ReturnType<typeof getCalendarContext>,
  env: ServerEnv,
  requestId: string
) {
  const retrievalMode = getRetrievalMode(env);
  const retrievalContext = {
    solarTermKey: calendar.solarTermKey,
    constitution: payload.userProfile.constitution,
    mood: payload.userProfile.todayMood,
    healthTags: payload.userProfile.healthTags,
    dailySupplement: payload.dailySupplement
  };
  const queryText =
    retrievalMode === "hybrid" ? buildKnowledgeQueryText(retrievalContext) : undefined;
  const canUseEmbeddingIndex =
    retrievalMode === "hybrid" && isKnowledgeEmbeddingIndexUsable(KNOWLEDGE_EMBEDDING_INDEX);
  let queryEmbedding: number[] | undefined;

  if (canUseEmbeddingIndex && queryText) {
    try {
      const queryVector = await buildQueryVector(
        retrievalContext,
        queryText,
        env,
        KNOWLEDGE_EMBEDDING_INDEX
      );
      queryEmbedding = queryVector.vector;
    } catch (error) {
      console.warn(
        `[generate:${requestId}] retrieval-embedding-failed ${JSON.stringify({
          message: error instanceof Error ? error.message : String(error)
        })}`
      );
    }
  }

  return selectKnowledge(retrievalContext, {
    retrievalMode,
    embeddingIndex: KNOWLEDGE_EMBEDDING_INDEX,
    queryEmbedding,
    queryText
  });
}

function logRejectedRequest(
  requestId: string,
  code: GenerateErrorResponse["error"]["code"],
  detail: string
) {
  console.warn(`[generate:${requestId}] rejected code=${code} ${detail}`);
}

function createRepairReport(message: string): GenerationQualityReport {
  return {
    ok: false,
    score: 0,
    issues: [
      {
        code: "low_action_coverage",
        severity: "error",
        message
      }
    ],
    metrics: {
      seasonalGroundedAdviceCount: 0,
      personalGroundedAdviceCount: 0,
      groundedAdviceCount: 0,
      templateHitCount: 0,
      repeatedAdviceOpeners: [],
      matchedKnowledgeIds: []
    }
  };
}

export async function generateTianji(
  body: unknown,
  env: ServerEnv = process.env,
  requestId = randomUUID()
): Promise<GenerateSuccessResponse | GenerateErrorResponse> {
  if (!isValidRequestBody(body)) {
    logRejectedRequest(requestId, "INVALID_INPUT", "validation=body-shape");
    return errorResponse("INVALID_INPUT", "输入结构或枚举值不合法。");
  }

  const payload = body as GenerateRequestPayload;

  if (payload.context.timezone !== SHANGHAI_TIMEZONE) {
    logRejectedRequest(requestId, "INVALID_INPUT", `timezone=${payload.context.timezone}`);
    return errorResponse("INVALID_INPUT", "仅支持 Asia/Shanghai 时区。");
  }

  if (!Number.isInteger(payload.pressDurationMs) || payload.pressDurationMs < 2000) {
    logRejectedRequest(requestId, "PRESS_TOO_SHORT", `pressDurationMs=${payload.pressDurationMs}`);
    return errorResponse("PRESS_TOO_SHORT", "请再静心一会儿。");
  }

  if (payload.pressDurationMs > 30000) {
    logRejectedRequest(requestId, "INVALID_INPUT", `pressDurationMs=${payload.pressDurationMs}`);
    return errorResponse("INVALID_INPUT", "长按时间超出允许范围。");
  }

  const quota = getQuotaState(payload.clientId, payload.context.timestamp);
  if (quota.count >= MAX_DAILY_QUOTA) {
    logRejectedRequest(requestId, "RATE_LIMIT_EXCEEDED", `clientId=${payload.clientId.slice(0, 8)} quota=${quota.count}`);
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
  const previewCue = buildPreviewCue(hexagram, payload.userProfile.todayMood);
  const knowledgeSelection = await prepareKnowledgeSelection(payload, calendar, env, requestId);
  const knowledgeEntries = knowledgeSelection.entries;
  const knowledgeIds = knowledgeEntries.map((entry) => entry.id);
  const ruleCandidateIds = knowledgeSelection.diagnostics.scored
    .filter((item) => item.ruleScore > 0)
    .slice(0, 5)
    .map((item) => item.id);
  const systemPrompt = buildSystemPrompt();
  const baseUserPrompt = buildUserPrompt(
    calendar,
    hexagram,
    payload.userProfile,
    payload.dailySupplement,
    knowledgeSelection,
    previewCue
  );
  const providerConfig = getProviderConfig(env);
  const providerOrder = getProviderOrder(env.AI_PROVIDER);
  const attempts: ProviderAttemptLog[] = [];

  console.info(
    `[generate:${requestId}] start ${summarizeConfiguredProviders(env, providerOrder)} mood=${
      payload.userProfile.todayMood
    } pressDurationMs=${payload.pressDurationMs} location=${
      payload.context.location ? "yes" : "no"
    } retrieval=${knowledgeSelection.diagnostics.effectiveRetrievalMode} requestedRetrieval=${
      knowledgeSelection.diagnostics.requestedRetrievalMode
    } retrievalFallback=${knowledgeSelection.diagnostics.retrievalFallbackReason ?? "none"} knowledge=${
      knowledgeIds.join(",") || "none"
    } ruleCandidates=${
      ruleCandidateIds.join(",") || "none"
    } vectorCandidates=${
      knowledgeSelection.diagnostics.vectorCandidateIds.join(",") || "none"
    }`
  );

  for (const provider of providerOrder) {
    let attemptCount = 0;
    let currentUserPrompt = baseUserPrompt;

    while (attemptCount < GENERATION_ATTEMPT_LIMIT) {
      try {
        const providerResult = await callProvider(
          provider,
          providerConfig,
          systemPrompt,
          currentUserPrompt
        );
        const normalized = normalizeGeneratedData(providerResult.payload);

        if (!normalized) {
          attempts.push({
            provider: providerResult.provider,
            model: providerResult.model,
            latencyMs: providerResult.latencyMs,
            status: "error",
            statusCode: providerResult.statusCode,
            providerRequestId: providerResult.providerRequestId,
            errorType: "schema",
            errorSummary: "Model output failed normalization or overlap checks."
          });

          attemptCount += 1;
          if (attemptCount < GENERATION_ATTEMPT_LIMIT) {
            currentUserPrompt = buildRepairUserPrompt(
              baseUserPrompt,
              providerResult.payload,
              createRepairReport("输出没有通过结构、长度或字段去重校验。")
            );
            continue;
          }
          break;
        }

        const qualityReport = evaluateGenerationQuality(normalized, knowledgeSelection);
        if (!qualityReport.ok) {
          attempts.push({
            provider: providerResult.provider,
            model: providerResult.model,
            latencyMs: providerResult.latencyMs,
            status: "error",
            statusCode: providerResult.statusCode,
            providerRequestId: providerResult.providerRequestId,
            errorType: "schema",
            errorSummary: summarizeQualityIssues(qualityReport)
          });

          attemptCount += 1;
          if (attemptCount < GENERATION_ATTEMPT_LIMIT) {
            currentUserPrompt = buildRepairUserPrompt(
              baseUserPrompt,
              normalized,
              qualityReport
            );
            continue;
          }
          break;
        }

        attempts.push({
          provider: providerResult.provider,
          model: providerResult.model,
          latencyMs: providerResult.latencyMs,
          status: "success",
          statusCode: providerResult.statusCode,
          providerRequestId: providerResult.providerRequestId
        });

        const result = buildSuccessResult(
          normalized,
          requestId,
          providerResult.provider,
          calendar,
          hexagram,
          knowledgeIds
        );
        console.info(
          `[generate:${requestId}] quality score=${qualityReport.score} grounded=${qualityReport.metrics.groundedAdviceCount}/3 templateHits=${qualityReport.metrics.templateHitCount}`
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
          attemptCount + 1 < GENERATION_ATTEMPT_LIMIT
        ) {
          attemptCount += 1;
          currentUserPrompt = baseUserPrompt;
          continue;
        }

        break;
      }
    }
  }

  const fallbackReasonCode = getFallbackReasonCode(attempts);
  const fallback = appendRequestMeta(
    buildFallbackResult(
      calendar,
      hexagram,
      knowledgeEntries,
      payload.userProfile,
      payload.dailySupplement
    ),
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
