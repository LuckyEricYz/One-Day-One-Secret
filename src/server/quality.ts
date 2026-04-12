import type { KnowledgeEntry, TianjiData } from "../types.js";
import type { KnowledgeSelection } from "./knowledge.js";

export type GenerationQualityIssueCode =
  | "missing_seasonal_grounding"
  | "missing_personal_grounding"
  | "low_action_coverage"
  | "template_phrase"
  | "template_heavy"
  | "repetitive_advice_openers";

export type GenerationQualityIssue = {
  code: GenerationQualityIssueCode;
  severity: "error" | "warn";
  message: string;
};

export type GenerationQualityReport = {
  ok: boolean;
  score: number;
  issues: GenerationQualityIssue[];
  metrics: {
    seasonalGroundedAdviceCount: number;
    personalGroundedAdviceCount: number;
    groundedAdviceCount: number;
    templateHitCount: number;
    repeatedAdviceOpeners: string[];
    matchedKnowledgeIds: string[];
  };
};

export type BatchVariationReport = {
  repeatedSayings: Array<{ text: string; samples: string[] }>;
  repeatedAdvice: Array<{ text: string; samples: string[] }>;
  repeatedAdviceOpeners: Array<{ opener: string; samples: string[] }>;
};

type NormalizedTianjiData = Omit<TianjiData, "meta">;

const TEMPLATE_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /你今天偏/u, message: "不要用“你今天偏...”作为固定解释模板。" },
  { pattern: /先把.{2,18}安顿好/u, message: "避免使用“先把…安顿好”的固定收口句。" },
  { pattern: /更适合先顾/u, message: "避免使用“更适合先顾...”的模板句。" },
  { pattern: /再谈加码/u, message: "避免使用“再谈加码”这类固定尾句。" },
  { pattern: /今天更适合/u, message: "避免使用“今天更适合...”这类通用开头。" }
] as const;

function toComparisonKey(value: string): string {
  return value.replace(/[0-9０-９]/gu, "").replace(/[\s，。！？；：、,.!?;:()（）\-]/gu, "");
}

function buildBigrams(value: string): Set<string> {
  if (value.length < 2) {
    return new Set(value ? [value] : []);
  }

  const next = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) {
    next.add(value.slice(index, index + 2));
  }

  return next;
}

function overlapScore(left: string, right: string): number {
  const leftBigrams = buildBigrams(left);
  const rightBigrams = buildBigrams(right);

  if (leftBigrams.size === 0 || rightBigrams.size === 0) {
    return 0;
  }

  let intersection = 0;
  leftBigrams.forEach((token) => {
    if (rightBigrams.has(token)) {
      intersection += 1;
    }
  });

  return intersection / Math.min(leftBigrams.size, rightBigrams.size);
}

function isGroundedText(left: string, right: string): boolean {
  const normalizedLeft = toComparisonKey(left);
  const normalizedRight = toComparisonKey(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const shorter =
    normalizedLeft.length <= normalizedRight.length ? normalizedLeft : normalizedRight;
  const longer =
    normalizedLeft.length <= normalizedRight.length ? normalizedRight : normalizedLeft;

  if (shorter.length >= 4 && longer.includes(shorter)) {
    return true;
  }

  return overlapScore(normalizedLeft, normalizedRight) >= 0.56;
}

function collectActionPhrases(entries: Array<KnowledgeEntry | undefined>): string[] {
  return entries.flatMap((entry) => (entry ? entry.actionItems : []));
}

function collectMatchedAdviceCount(advice: string[], phrases: string[]): {
  adviceIndexes: number[];
  phraseIndexes: number[];
} {
  const adviceIndexes = new Set<number>();
  const phraseIndexes = new Set<number>();

  advice.forEach((line, adviceIndex) => {
    phrases.forEach((phrase, phraseIndex) => {
      if (isGroundedText(line, phrase)) {
        adviceIndexes.add(adviceIndex);
        phraseIndexes.add(phraseIndex);
      }
    });
  });

  return {
    adviceIndexes: [...adviceIndexes],
    phraseIndexes: [...phraseIndexes]
  };
}

function getAdviceOpeners(lines: string[]): string[] {
  return lines
    .map((line) => line.trim().slice(0, 2))
    .filter((value) => value.length === 2);
}

function getRepeatedAdviceOpeners(lines: string[]): string[] {
  const counts = new Map<string, number>();

  getAdviceOpeners(lines).forEach((opener) => {
    counts.set(opener, (counts.get(opener) ?? 0) + 1);
  });

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([opener]) => opener);
}

function addIssue(
  issues: GenerationQualityIssue[],
  code: GenerationQualityIssueCode,
  severity: "error" | "warn",
  message: string
) {
  issues.push({ code, severity, message });
}

export function evaluateGenerationQuality(
  data: NormalizedTianjiData,
  selection: KnowledgeSelection
): GenerationQualityReport {
  const seasonalPhrases = collectActionPhrases([selection.seasonal]);
  const personalEntries = [
    selection.targeted,
    selection.recovery,
    ...selection.supplemental
  ];
  const personalPhrases = collectActionPhrases(personalEntries);

  const seasonalMatches = collectMatchedAdviceCount(data.healthAdvice, seasonalPhrases);
  const personalMatches = collectMatchedAdviceCount(data.healthAdvice, personalPhrases);
  const groundedAdviceIndexes = new Set([
    ...seasonalMatches.adviceIndexes,
    ...personalMatches.adviceIndexes
  ]);

  const templateHits = TEMPLATE_PATTERNS.filter(
    ({ pattern }) =>
      pattern.test(data.mysticSaying) ||
      pattern.test(data.mysticExplanation) ||
      data.healthAdvice.some((line) => pattern.test(line))
  );
  const repeatedAdviceOpeners = getRepeatedAdviceOpeners(data.healthAdvice);

  const issues: GenerationQualityIssue[] = [];

  if (seasonalPhrases.length > 0 && seasonalMatches.adviceIndexes.length === 0) {
    addIssue(
      issues,
      "missing_seasonal_grounding",
      "error",
      "至少 1 条 advice 需要明显承接节气动作。"
    );
  }

  if (personalPhrases.length > 0 && personalMatches.adviceIndexes.length === 0) {
    addIssue(
      issues,
      "missing_personal_grounding",
      "error",
      "至少 1 条 advice 需要明显承接人物状态或生活标签动作。"
    );
  }

  if (groundedAdviceIndexes.size < 2) {
    addIssue(
      issues,
      "low_action_coverage",
      "error",
      "3 条 advice 里至少 2 条要能看出来自已选知识动作。"
    );
  }

  if (templateHits.length >= 2) {
    addIssue(
      issues,
      "template_heavy",
      "error",
      templateHits.map((item) => item.message).join(" ")
    );
  } else if (templateHits.length === 1) {
    addIssue(issues, "template_phrase", "warn", templateHits[0].message);
  }

  if (repeatedAdviceOpeners.length > 0) {
    addIssue(
      issues,
      "repetitive_advice_openers",
      "warn",
      `Advice 起句重复：${repeatedAdviceOpeners.join("、")}。`
    );
  }

  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === "error" ? 22 : 8), 0);
  const matchedKnowledgeIds = [
    selection.seasonal,
    ...personalEntries
  ]
    .filter((entry): entry is KnowledgeEntry => Boolean(entry))
    .map((entry) => entry.id);

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    score: Math.max(0, 100 - penalty),
    issues,
    metrics: {
      seasonalGroundedAdviceCount: seasonalMatches.adviceIndexes.length,
      personalGroundedAdviceCount: personalMatches.adviceIndexes.length,
      groundedAdviceCount: groundedAdviceIndexes.size,
      templateHitCount: templateHits.length,
      repeatedAdviceOpeners,
      matchedKnowledgeIds
    }
  };
}

export function summarizeQualityIssues(report: GenerationQualityReport): string {
  if (report.issues.length === 0) {
    return "passed quality gate";
  }

  return report.issues.map((issue) => issue.message).join(" ");
}

function collectRepeatedText(
  items: Array<{ sample: string; text: string }>
): Array<{ text: string; samples: string[] }> {
  const groups = new Map<string, { text: string; samples: string[] }>();

  items.forEach((item) => {
    const key = toComparisonKey(item.text);
    if (!key) {
      return;
    }

    const existing = groups.get(key);
    if (existing) {
      existing.samples.push(item.sample);
      return;
    }

    groups.set(key, {
      text: item.text,
      samples: [item.sample]
    });
  });

  return [...groups.values()].filter((group) => group.samples.length >= 2);
}

export function evaluateBatchVariation(
  results: Array<{ sample: string; data: NormalizedTianjiData }>
): BatchVariationReport {
  const repeatedSayings = collectRepeatedText(
    results.map((item) => ({
      sample: item.sample,
      text: item.data.mysticSaying
    }))
  );
  const repeatedAdvice = collectRepeatedText(
    results.flatMap((item) =>
      item.data.healthAdvice.map((line) => ({
        sample: item.sample,
        text: line
      }))
    )
  );
  const repeatedAdviceOpeners = collectRepeatedText(
    results.flatMap((item) =>
      getAdviceOpeners(item.data.healthAdvice).map((opener) => ({
        sample: item.sample,
        text: opener
      }))
    )
  ).map((group) => ({
    opener: group.text,
    samples: group.samples
  }));

  return {
    repeatedSayings,
    repeatedAdvice,
    repeatedAdviceOpeners
  };
}
