import { loadDevEnv } from "../src/server/env";
import { generateTianji } from "../src/server/generate-service";
import type { GenerateRequestPayload } from "../src/types";

function buildPayload(): GenerateRequestPayload {
  return {
    clientId: "smoke-client",
    pressDurationMs: 3600,
    touchEntropy: 28,
    userProfile: {
      constitution: "balanced",
      healthTags: ["regular_exercise"],
      todayMood: "calm",
      tongueDiagnosis: null
    },
    context: {
      timestamp: Date.now(),
      timezone: "Asia/Shanghai"
    }
  };
}

async function main() {
  const loadedEnv = loadDevEnv();
  const result = await generateTianji(buildPayload(), loadedEnv.env);

  if (!result.success) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: result.error
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: result.data.meta.provider,
        isFallback: result.data.meta.isFallback,
        requestId: result.data.meta.requestId,
        fallbackReasonCode: result.data.meta.fallbackReasonCode,
        remainingQuota: result.remainingQuota
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
