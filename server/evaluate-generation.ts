import { getCalendarContext } from "../src/server/calendar";
import { loadDevEnv } from "../src/server/env";
import { buildFallbackResult } from "../src/server/fallback";
import { generateTianji } from "../src/server/generate-service";
import { getHexagramContext } from "../src/server/hexagrams";
import { retrieveKnowledge } from "../src/server/knowledge";
import type { GenerateRequestPayload, UserProfile } from "../src/types";

type SampleCase = {
  id: string;
  pressDurationMs: number;
  touchEntropy: number;
  userProfile: UserProfile;
};

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
    }
  }
];

function buildPayload(sample: SampleCase, timestamp: number): GenerateRequestPayload {
  return {
    clientId: `eval-${sample.id}`,
    pressDurationMs: sample.pressDurationMs,
    touchEntropy: sample.touchEntropy,
    userProfile: sample.userProfile,
    context: {
      timestamp,
      timezone: "Asia/Shanghai"
    }
  };
}

function summarizeResult(result: {
  mysticSaying: string;
  mysticExplanation: string;
  healthAdvice: readonly string[];
  dos: readonly string[];
  donts: readonly string[];
  meta: { provider: string; isFallback: boolean; knowledgeIds: string[] };
}) {
  return {
    provider: result.meta.provider,
    isFallback: result.meta.isFallback,
    mysticSaying: result.mysticSaying,
    mysticExplanation: result.mysticExplanation,
    healthAdvice: result.healthAdvice,
    dos: result.dos,
    donts: result.donts,
    knowledgeIds: result.meta.knowledgeIds
  };
}

async function main() {
  const loadedEnv = loadDevEnv();
  const timestamp = Date.now();

  for (const sample of SAMPLE_CASES) {
    const payload = buildPayload(sample, timestamp);
    const generated = await generateTianji(payload, loadedEnv.env);
    const calendar = getCalendarContext(payload.context.timestamp);
    const hexagram = getHexagramContext(
      payload.pressDurationMs,
      payload.context.timestamp,
      payload.touchEntropy ?? 0
    );
    const entries = retrieveKnowledge({
      solarTermKey: calendar.solarTermKey,
      constitution: payload.userProfile.constitution,
      mood: payload.userProfile.todayMood,
      healthTags: payload.userProfile.healthTags
    });
    const fallback = buildFallbackResult(calendar, hexagram, entries, payload.userProfile);

    console.log(
      JSON.stringify(
        {
          sample: sample.id,
          generated: generated.success ? summarizeResult(generated.data) : generated,
          fallback: summarizeResult(fallback)
        },
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
