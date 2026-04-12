import { buildFallbackResult } from "../src/server/fallback.js";
import { loadDevEnv } from "../src/server/env.js";
import { generateTianji } from "../src/server/generate-service.js";
import { selectKnowledge } from "../src/server/knowledge.js";
import { KNOWLEDGE_EMBEDDING_INDEX } from "../src/server/knowledge-index.generated.js";
import { defaultDailySupplement } from "../src/shared/supplement.js";
import {
  evaluateBatchVariation,
  evaluateGenerationQuality
} from "../src/server/quality.js";
import {
  buildKnowledgeQueryText,
  buildQueryVector,
  isKnowledgeEmbeddingIndexUsable,
  type KnowledgeRetrievalMode
} from "../src/server/rag.js";
import { getCalendarContext } from "../src/server/calendar.js";
import { getHexagramContext } from "../src/server/hexagrams.js";
import type {
  DailySupplement,
  GenerateRequestPayload,
  TianjiData,
  UserProfile
} from "../src/types.js";

type SampleCase = {
  id: string;
  pressDurationMs: number;
  touchEntropy: number;
  userProfile: UserProfile;
  dailySupplement: DailySupplement;
};

type EvaluationMode = KnowledgeRetrievalMode | "compare";

const FIXED_EVAL_TIMESTAMP = Date.parse("2026-04-11T13:30:00+08:00");

const SAMPLE_CASES: SampleCase[] = [
  {
    id: "calm-regular",
    pressDurationMs: 3600,
    touchEntropy: 28,
    userProfile: {
      constitution: "balanced",
      healthTags: ["regular_exercise"],
      todayMood: "calm",
      tongueDiagnosis: null
    },
    dailySupplement: defaultDailySupplement
  },
  {
    id: "calm-irregular",
    pressDurationMs: 3660,
    touchEntropy: 35,
    userProfile: {
      constitution: "qi_deficiency",
      healthTags: ["irregular_diet"],
      todayMood: "calm",
      tongueDiagnosis: null
    },
    dailySupplement: {
      headSense: "slightly_full",
      sleepDuration: "medium",
      tongueCoating: "thick_white"
    }
  },
  {
    id: "tired-sedentary",
    pressDurationMs: 4120,
    touchEntropy: 47,
    userProfile: {
      constitution: "qi_deficiency",
      healthTags: ["late_sleep", "sedentary"],
      todayMood: "tired",
      tongueDiagnosis: null
    },
    dailySupplement: {
      headSense: "slightly_full",
      sleepDuration: "short",
      tongueCoating: "thin_white"
    }
  },
  {
    id: "tired-late-sleep",
    pressDurationMs: 4240,
    touchEntropy: 50,
    userProfile: {
      constitution: "yang_deficiency",
      healthTags: ["late_sleep"],
      todayMood: "tired",
      tongueDiagnosis: null
    },
    dailySupplement: {
      headSense: "clear",
      sleepDuration: "short",
      tongueCoating: "thick_white"
    }
  },
  {
    id: "anxious-irregular",
    pressDurationMs: 4870,
    touchEntropy: 61,
    userProfile: {
      constitution: "qi_stagnation",
      healthTags: ["late_sleep", "irregular_diet"],
      todayMood: "anxious",
      tongueDiagnosis: null
    },
    dailySupplement: {
      headSense: "rising",
      sleepDuration: "short",
      tongueCoating: "slightly_yellow"
    }
  },
  {
    id: "anxious-balanced",
    pressDurationMs: 4930,
    touchEntropy: 63,
    userProfile: {
      constitution: "balanced",
      healthTags: [],
      todayMood: "anxious",
      tongueDiagnosis: null
    },
    dailySupplement: {
      headSense: "rising",
      sleepDuration: "medium",
      tongueCoating: "thin_white"
    }
  },
  {
    id: "sad-irregular",
    pressDurationMs: 5160,
    touchEntropy: 70,
    userProfile: {
      constitution: "yang_deficiency",
      healthTags: ["irregular_diet"],
      todayMood: "sad",
      tongueDiagnosis: null
    },
    dailySupplement: {
      headSense: "clear",
      sleepDuration: "medium",
      tongueCoating: "thick_white"
    }
  },
  {
    id: "angry-late-sleep",
    pressDurationMs: 5380,
    touchEntropy: 73,
    userProfile: {
      constitution: "yang_deficiency",
      healthTags: ["late_sleep"],
      todayMood: "angry",
      tongueDiagnosis: null
    },
    dailySupplement: {
      headSense: "rising",
      sleepDuration: "short",
      tongueCoating: "slightly_yellow"
    }
  },
  {
    id: "happy-regular",
    pressDurationMs: 5560,
    touchEntropy: 79,
    userProfile: {
      constitution: "balanced",
      healthTags: ["regular_exercise"],
      todayMood: "happy",
      tongueDiagnosis: null
    },
    dailySupplement: {
      headSense: "clear",
      sleepDuration: "long",
      tongueCoating: "thin_white"
    }
  },
  {
    id: "happy-sedentary",
    pressDurationMs: 5790,
    touchEntropy: 84,
    userProfile: {
      constitution: "phlegm_dampness",
      healthTags: ["sedentary"],
      todayMood: "happy",
      tongueDiagnosis: null
    },
    dailySupplement: {
      headSense: "slightly_full",
      sleepDuration: "medium",
      tongueCoating: "thick_white"
    }
  }
];

function parseEvaluationMode(argv: string[]): EvaluationMode {
  const rawMode = argv
    .find((item) => item.startsWith("--mode="))
    ?.slice("--mode=".length);

  if (rawMode === "rules" || rawMode === "hybrid" || rawMode === "compare") {
    return rawMode;
  }

  return "compare";
}

function buildPayload(sample: SampleCase): GenerateRequestPayload {
  return {
    clientId: `eval-${sample.id}`,
    pressDurationMs: sample.pressDurationMs,
    touchEntropy: sample.touchEntropy,
    userProfile: sample.userProfile,
    dailySupplement: sample.dailySupplement,
    context: {
      timestamp: FIXED_EVAL_TIMESTAMP,
      timezone: "Asia/Shanghai"
    }
  };
}

function summarizeTianji(data: TianjiData) {
  return {
    provider: data.meta.provider,
    isFallback: data.meta.isFallback,
    mysticSaying: data.mysticSaying,
    mysticExplanation: data.mysticExplanation,
    healthAdvice: data.healthAdvice,
    dos: data.dos,
    donts: data.donts,
    knowledgeIds: data.meta.knowledgeIds
  };
}

function summarizeSelection(selection: ReturnType<typeof selectKnowledge>) {
  return {
    seasonal: selection.seasonal?.id,
    targeted: selection.targeted?.id,
    recovery: selection.recovery?.id,
    supplemental: selection.supplemental.map((entry) => entry.id),
    targetedCategories: selection.diagnostics.targetedCategories,
    recoveryCategories: selection.diagnostics.recoveryCategories,
    requestedRetrievalMode: selection.diagnostics.requestedRetrievalMode,
    effectiveRetrievalMode: selection.diagnostics.effectiveRetrievalMode,
    retrievalFallbackReason: selection.diagnostics.retrievalFallbackReason,
    vectorEligibleCount: selection.diagnostics.vectorEligibleCount,
    vectorCandidateIds: selection.diagnostics.vectorCandidateIds,
    vectorSelectedIds: selection.diagnostics.vectorSelectedIds,
    selectedEntryIds: selection.diagnostics.selectedEntryIds
  };
}

function summarizeQuality(
  data: Omit<TianjiData, "meta">,
  selection: ReturnType<typeof selectKnowledge>
) {
  const report = evaluateGenerationQuality(data, selection);

  return {
    ok: report.ok,
    score: report.score,
    issues: report.issues,
    metrics: report.metrics
  };
}

function summarizeAggregate(
  results: Array<{
    sample: string;
    data: Omit<TianjiData, "meta">;
    qualityScore: number;
  }>
) {
  const averageScore =
    results.length > 0
      ? Number(
          (results.reduce((sum, item) => sum + item.qualityScore, 0) / results.length).toFixed(1)
        )
      : 0;

  return {
    averageScore,
    variation: evaluateBatchVariation(
      results.map((item) => ({
        sample: item.sample,
        data: item.data
      }))
    )
  };
}

async function selectKnowledgeForMode(
  sample: SampleCase,
  calendar: ReturnType<typeof getCalendarContext>,
  env: Record<string, string | undefined>,
  mode: KnowledgeRetrievalMode
) {
  const context = {
    solarTermKey: calendar.solarTermKey,
    constitution: sample.userProfile.constitution,
    mood: sample.userProfile.todayMood,
    healthTags: sample.userProfile.healthTags,
    dailySupplement: sample.dailySupplement
  };

  if (mode === "rules") {
    return {
      selection: selectKnowledge(context, { retrievalMode: "rules" })
    };
  }

  const queryText = buildKnowledgeQueryText(context);
  let queryEmbedding: number[] | undefined;
  let embeddingError: string | undefined;

  if (isKnowledgeEmbeddingIndexUsable(KNOWLEDGE_EMBEDDING_INDEX)) {
    try {
      const queryVector = await buildQueryVector(
        context,
        queryText,
        env,
        KNOWLEDGE_EMBEDDING_INDEX
      );
      queryEmbedding = queryVector.vector;
    } catch (error) {
      embeddingError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    selection: selectKnowledge(context, {
      retrievalMode: "hybrid",
      embeddingIndex: KNOWLEDGE_EMBEDDING_INDEX,
      queryEmbedding,
      queryText
    }),
    embeddingError
  };
}

async function evaluateMode(
  loadedEnv: ReturnType<typeof loadDevEnv>,
  mode: KnowledgeRetrievalMode
) {
  const envForMode = {
    ...loadedEnv.env,
    RAG_RETRIEVAL_MODE: mode
  };
  const calendar = getCalendarContext(FIXED_EVAL_TIMESTAMP);
  const generatedBatch: Array<{
    sample: string;
    data: Omit<TianjiData, "meta">;
    qualityScore: number;
  }> = [];
  const fallbackBatch: Array<{
    sample: string;
    data: Omit<TianjiData, "meta">;
    qualityScore: number;
  }> = [];
  const cases = [];

  for (const sample of SAMPLE_CASES) {
    const payload = buildPayload(sample);
    const { selection, embeddingError } = await selectKnowledgeForMode(
      sample,
      calendar,
      envForMode,
      mode
    );
    const generated = await generateTianji(payload, envForMode);
    const hexagram = getHexagramContext(
      payload.pressDurationMs,
      payload.context.timestamp,
      payload.touchEntropy ?? 0
    );
    const fallback = buildFallbackResult(
      calendar,
      hexagram,
      selection.entries,
      payload.userProfile,
      payload.dailySupplement
    );

    const fallbackQuality = summarizeQuality(fallback, selection);
    fallbackBatch.push({
      sample: sample.id,
      data: fallback,
      qualityScore: fallbackQuality.score
    });

    let generatedSummary:
      | typeof generated
      | {
          provider: TianjiData["meta"]["provider"];
          isFallback: boolean;
          mysticSaying: string;
          mysticExplanation: string;
          healthAdvice: [string, string, string];
          dos: [string, string];
          donts: [string, string];
          knowledgeIds: string[];
          quality: ReturnType<typeof summarizeQuality>;
        };

    if (generated.success) {
      const quality = summarizeQuality(generated.data, selection);
      generatedSummary = {
        ...summarizeTianji(generated.data),
        quality
      };
      generatedBatch.push({
        sample: sample.id,
        data: generated.data,
        qualityScore: quality.score
      });
    } else {
      generatedSummary = generated;
    }

    cases.push({
      sample: sample.id,
      knowledge: summarizeSelection(selection),
      retrievalEmbeddingError: embeddingError,
      generated: generatedSummary,
      fallback: {
        ...summarizeTianji(fallback),
        quality: fallbackQuality
      }
    });
  }

  return {
    requestedMode: mode,
    indexUsable: isKnowledgeEmbeddingIndexUsable(KNOWLEDGE_EMBEDDING_INDEX),
    cases,
    aggregate: {
      generated: summarizeAggregate(generatedBatch),
      fallback: summarizeAggregate(fallbackBatch)
    }
  };
}

async function main() {
  const loadedEnv = loadDevEnv();
  const evaluationMode = parseEvaluationMode(process.argv.slice(2));
  const modes: KnowledgeRetrievalMode[] =
    evaluationMode === "compare" ? ["rules", "hybrid"] : [evaluationMode];
  const results = await Promise.all(
    modes.map(async (mode) => [mode, await evaluateMode(loadedEnv, mode)] as const)
  );

  console.log(
    JSON.stringify(
      {
        providerPreference: loadedEnv.env.AI_PROVIDER ?? "auto",
        evaluationMode,
        timestamp: new Date(FIXED_EVAL_TIMESTAMP).toISOString(),
        sampleCount: SAMPLE_CASES.length,
        results: Object.fromEntries(results)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
