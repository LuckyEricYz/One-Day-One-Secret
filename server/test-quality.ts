import assert from "node:assert/strict";

import { getCalendarContext } from "../src/server/calendar.js";
import { selectKnowledge } from "../src/server/knowledge.js";
import type { KnowledgeEmbeddingIndex } from "../src/server/rag.js";
import { defaultDailySupplement } from "../src/shared/supplement.js";
import {
  evaluateBatchVariation,
  evaluateGenerationQuality
} from "../src/server/quality.js";

const TEST_TIMESTAMP = Date.parse("2026-04-11T13:30:00+08:00");

const FIXTURE_INDEX: KnowledgeEmbeddingIndex = {
  version: 2,
  strategy: "chat_signature",
  model: "fixture",
  generatedAt: "2026-04-12T00:00:00.000Z",
  itemCount: 4,
  dimension: 3,
  items: [
    {
      id: "exercise-001",
      searchText: "fixture",
      embedding: [1, 0, 0]
    },
    {
      id: "sleep-003",
      searchText: "fixture",
      embedding: [0.95, 0.05, 0]
    },
    {
      id: "diet-004",
      searchText: "fixture",
      embedding: [0.92, 0.08, 0]
    },
    {
      id: "emotion-001",
      searchText: "fixture",
      embedding: [0.7, 0.3, 0]
    }
  ]
};

function runKnowledgeSelectionAssertions() {
  const calendar = getCalendarContext(TEST_TIMESTAMP);
  const selection = selectKnowledge({
    solarTermKey: calendar.solarTermKey,
    constitution: "qi_deficiency",
    mood: "tired",
    healthTags: ["late_sleep", "sedentary"],
    dailySupplement: defaultDailySupplement
  });

  assert.ok(selection.seasonal, "selection should include a seasonal entry");
  assert.equal(
    selection.entries.filter((entry) => entry.category === "seasonal").length,
    1,
    "selection should include exactly one seasonal entry"
  );
  assert.ok(
    selection.seasonal.tags.solarTerms.includes(calendar.solarTermKey),
    "seasonal entry should match current solar term"
  );
  assert.ok(selection.targeted, "selection should include a targeted entry");
  assert.ok(selection.recovery, "selection should include a recovery entry");
  assert.notEqual(
    selection.targeted.id,
    selection.recovery.id,
    "targeted and recovery entries should be different"
  );
}

function runHybridSelectionAssertions() {
  const calendar = getCalendarContext(TEST_TIMESTAMP);
  const selection = selectKnowledge(
    {
      solarTermKey: calendar.solarTermKey,
      constitution: "qi_deficiency",
      mood: "tired",
      healthTags: ["late_sleep", "sedentary"],
      dailySupplement: defaultDailySupplement
    },
    {
      retrievalMode: "hybrid",
      embeddingIndex: FIXTURE_INDEX,
      queryEmbedding: [1, 0, 0],
      queryText: "清明 疲惫 久坐 熬夜"
    }
  );

  assert.equal(
    selection.diagnostics.effectiveRetrievalMode,
    "hybrid",
    "hybrid selection should remain enabled when vectors are available"
  );
  assert.equal(
    selection.diagnostics.vectorCandidateIds.includes("exercise-001"),
    true,
    "hybrid selection should include vector-ranked candidates"
  );
  const boostedItem = selection.diagnostics.scored.find((item) => item.id === "diet-004");
  assert.ok(boostedItem, "hybrid diagnostics should include boosted entries");
  assert.equal(
    Boolean(boostedItem && boostedItem.score > boostedItem.ruleScore),
    true,
    "hybrid selection should raise the fused score of vector-matched entries"
  );
}

function runHybridFallbackAssertions() {
  const calendar = getCalendarContext(TEST_TIMESTAMP);
  const selection = selectKnowledge(
    {
      solarTermKey: calendar.solarTermKey,
      constitution: "qi_deficiency",
      mood: "tired",
      healthTags: ["late_sleep", "sedentary"],
      dailySupplement: defaultDailySupplement
    },
    {
      retrievalMode: "hybrid"
    }
  );

  assert.equal(
    selection.diagnostics.effectiveRetrievalMode,
    "rules",
    "hybrid selection should degrade to rules when no index is available"
  );
  assert.equal(
    selection.diagnostics.retrievalFallbackReason,
    "index_unavailable",
    "fallback reason should explain why hybrid retrieval was disabled"
  );
}

function runQualityGateAssertions() {
  const calendar = getCalendarContext(TEST_TIMESTAMP);
  const selection = selectKnowledge({
    solarTermKey: calendar.solarTermKey,
    constitution: "qi_deficiency",
    mood: "tired",
    healthTags: ["late_sleep", "sedentary"],
    dailySupplement: defaultDailySupplement
  });

  const groundedResult = {
    mysticSaying: "清明留白，缓缓起势",
    mysticExplanation: "清明风轻，今天把步行、收操和收尾放回正位，别把节奏推得太满。",
    healthAdvice: [
      "午后散步15-20分钟，让身体先展开",
      "把最晚工作截止时间前移，今晚别再拖",
      "主食和热食保持稳定，别再随便对付"
    ] as [string, string, string],
    dos: ["轻动舒展", "训练留余"] as [string, string],
    donts: ["夜里硬练", "熬夜硬撑"] as [string, string]
  };
  const groundedReport = evaluateGenerationQuality(groundedResult, selection);

  assert.equal(groundedReport.ok, true, "grounded result should pass quality gate");
  assert.equal(
    groundedReport.metrics.seasonalGroundedAdviceCount >= 1,
    true,
    "grounded result should contain at least one seasonal advice"
  );
  assert.equal(
    groundedReport.metrics.personalGroundedAdviceCount >= 1,
    true,
    "grounded result should contain at least one person-specific advice"
  );

  const templatedResult = {
    mysticSaying: "清明守中，先养气力",
    mysticExplanation: "清明时节宜轻展缓行。你今天偏疲惫，先把睡眠、吃饭和活动强度安顿好。",
    healthAdvice: [
      "把今天节奏放慢一点，先别继续加码",
      "给身体留一点余量，不必什么都做满",
      "今晚早点结束，别让自己继续消耗"
    ] as [string, string, string],
    dos: ["轻动舒展", "早点收尾"] as [string, string],
    donts: ["熬夜硬撑", "夜里硬练"] as [string, string]
  };
  const templatedReport = evaluateGenerationQuality(templatedResult, selection);

  assert.equal(templatedReport.ok, false, "templated result should fail quality gate");
  assert.equal(
    templatedReport.issues.some((issue) => issue.code === "template_heavy"),
    true,
    "templated result should be rejected for template-heavy phrasing"
  );
  assert.equal(
    templatedReport.issues.some((issue) => issue.code === "missing_seasonal_grounding"),
    true,
    "templated result should be rejected for missing seasonal grounding"
  );
}

function runVariationAssertions() {
  const report = evaluateBatchVariation([
    {
      sample: "case-a",
      data: {
        mysticSaying: "清明留白，缓缓起势",
        mysticExplanation: "清明风轻，今天把步行和收尾放回正位。",
        healthAdvice: [
          "午后慢走十五分钟，让身体先展开",
          "状态一般时把训练改成恢复课",
          "睡前二十分钟不看消息，早点收尾"
        ],
        dos: ["轻动舒展", "训练留余"],
        donts: ["夜里硬练", "熬夜硬撑"]
      }
    },
    {
      sample: "case-b",
      data: {
        mysticSaying: "清明留白，缓缓起势",
        mysticExplanation: "今天先把节奏拉回正轨，再慢慢推进。",
        healthAdvice: [
          "午后慢走十五分钟，让身体先展开",
          "晚餐七分饱，别把胃口吃得太急",
          "睡前二十分钟不看消息，早点收尾"
        ],
        dos: ["轻动舒展", "守时吃饭"],
        donts: ["夜里硬练", "熬夜硬撑"]
      }
    }
  ]);

  assert.equal(report.repeatedSayings.length, 1, "variation report should detect repeated sayings");
  assert.equal(report.repeatedAdvice.length >= 1, true, "variation report should detect repeated advice");
}

function main() {
  runKnowledgeSelectionAssertions();
  runHybridSelectionAssertions();
  runHybridFallbackAssertions();
  runQualityGateAssertions();
  runVariationAssertions();
  console.log("quality assertions passed");
}

main();
