import {
  CONSTITUTIONS,
  HEALTH_TAGS,
  MOODS,
  TONGUE_DIAGNOSIS_OPTIONS,
  type GenerateRequestPayload,
  type TianjiData
} from "../types";
import { SHANGHAI_TIMEZONE } from "../shared/time";

export const TIANJI_TEXT_LIMITS = {
  mysticSaying: { min: 4, max: 16 },
  mysticExplanation: { min: 18, max: 52 },
  healthAdvice: { min: 8, max: 24 },
  tags: { min: 2, max: 10 }
} as const;

const DISALLOWED_TEMPLATE_PATTERNS = [
  /已至，宜稳住身心/u,
  /^先稳其.{1,4}，再起其.{1,4}$/u,
  /^先稳节奏，再添劲头$/u,
  /今天的节气和卦象都更适合先收回多余消耗/u,
  /先把节奏守住，比继续加力更重要/u
] as const;

export const OPENAI_TIANJI_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    mysticSaying: {
      type: "string",
      minLength: TIANJI_TEXT_LIMITS.mysticSaying.min,
      maxLength: TIANJI_TEXT_LIMITS.mysticSaying.max
    },
    mysticExplanation: {
      type: "string",
      minLength: TIANJI_TEXT_LIMITS.mysticExplanation.min,
      maxLength: TIANJI_TEXT_LIMITS.mysticExplanation.max
    },
    healthAdvice: {
      type: "array",
      items: {
        type: "string",
        minLength: TIANJI_TEXT_LIMITS.healthAdvice.min,
        maxLength: TIANJI_TEXT_LIMITS.healthAdvice.max
      },
      minItems: 3,
      maxItems: 3
    },
    dos: {
      type: "array",
      items: {
        type: "string",
        minLength: TIANJI_TEXT_LIMITS.tags.min,
        maxLength: TIANJI_TEXT_LIMITS.tags.max
      },
      minItems: 2,
      maxItems: 2
    },
    donts: {
      type: "array",
      items: {
        type: "string",
        minLength: TIANJI_TEXT_LIMITS.tags.min,
        maxLength: TIANJI_TEXT_LIMITS.tags.max
      },
      minItems: 2,
      maxItems: 2
    }
  },
  required: [
    "mysticSaying",
    "mysticExplanation",
    "healthAdvice",
    "dos",
    "donts"
  ]
} as const;

export function isValidRequestBody(body: unknown): body is GenerateRequestPayload {
  if (!body || typeof body !== "object") return false;

  const payload = body as Record<string, unknown>;
  const userProfile =
    payload.userProfile && typeof payload.userProfile === "object"
      ? (payload.userProfile as Record<string, unknown>)
      : null;
  const context =
    payload.context && typeof payload.context === "object"
      ? (payload.context as Record<string, unknown>)
      : null;

  if (!payload.clientId || typeof payload.clientId !== "string") return false;
  if (!Number.isInteger(payload.pressDurationMs)) return false;
  if (payload.touchEntropy !== undefined && !Number.isInteger(payload.touchEntropy)) return false;
  if (!userProfile || !context) return false;

  if (!CONSTITUTIONS.includes(userProfile.constitution as (typeof CONSTITUTIONS)[number])) return false;
  if (!MOODS.includes(userProfile.todayMood as (typeof MOODS)[number])) return false;
  if (
    userProfile.tongueDiagnosis !== null &&
    userProfile.tongueDiagnosis !== undefined &&
    !TONGUE_DIAGNOSIS_OPTIONS.includes(
      userProfile.tongueDiagnosis as (typeof TONGUE_DIAGNOSIS_OPTIONS)[number]
    )
  ) {
    return false;
  }

  if (!Array.isArray(userProfile.healthTags)) return false;
  const unique = new Set(userProfile.healthTags);
  if (unique.size !== userProfile.healthTags.length) return false;
  if (
    !userProfile.healthTags.every((tag) =>
      HEALTH_TAGS.includes(tag as (typeof HEALTH_TAGS)[number])
    )
  ) {
    return false;
  }

  if (!Number.isInteger(context.timestamp)) return false;
  if (context.timezone !== SHANGHAI_TIMEZONE) return false;

  if (context.location !== undefined) {
    if (!context.location || typeof context.location !== "object") return false;
    const location = context.location as Record<string, unknown>;
    if (typeof location.latitude !== "number" || typeof location.longitude !== "number") {
      return false;
    }
  }

  return true;
}

function sanitizeText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function sanitizeSaying(value: string): string {
  return sanitizeText(value).replace(/[「」『』“”"]/gu, "");
}

function sanitizeTag(value: string): string {
  return sanitizeText(value).replace(/^[，。！？；：、,.!?;:]+|[，。！？；：、,.!?;:]+$/gu, "");
}

function isWithinRange(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

function containsDisallowedTemplate(value: string): boolean {
  return DISALLOWED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(value));
}

function isTagLike(value: string): boolean {
  return !/[，。！？；：,.!?;:\s]/u.test(value);
}

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

function isOverlappingText(left: string, right: string): boolean {
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

  return overlapScore(normalizedLeft, normalizedRight) >= 0.72;
}

function hasInternalOverlap(items: string[]): boolean {
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      if (isOverlappingText(items[left], items[right])) {
        return true;
      }
    }
  }

  return false;
}

function hasCrossOverlap(leftItems: string[], rightItems: string[]): boolean {
  return leftItems.some((left) => rightItems.some((right) => isOverlappingText(left, right)));
}

type PickStringOptions = {
  minLength: number;
  maxLength: number;
  sanitize?: (value: string) => string;
  requireTagLike?: boolean;
};

function pickStrings(
  value: unknown,
  expectedLength: number,
  options: PickStringOptions
): string[] | null {
  if (!Array.isArray(value) || value.length < expectedLength) return null;

  const next = value.slice(0, expectedLength).map((item) => {
    if (typeof item !== "string") {
      return null;
    }

    const normalized = (options.sanitize ?? sanitizeText)(item);
    if (!normalized) {
      return null;
    }

    if (!isWithinRange(normalized, options.minLength, options.maxLength)) {
      return null;
    }

    if (containsDisallowedTemplate(normalized)) {
      return null;
    }

    if (options.requireTagLike && !isTagLike(normalized)) {
      return null;
    }

    return normalized;
  });

  if (next.some((item) => item === null)) {
    return null;
  }

  return next as string[];
}

export function normalizeGeneratedData(
  input: unknown
): Omit<TianjiData, "meta"> | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const mysticSaying =
    typeof record.mysticSaying === "string" ? sanitizeSaying(record.mysticSaying) : "";
  const mysticExplanation =
    typeof record.mysticExplanation === "string" ? sanitizeText(record.mysticExplanation) : "";
  const healthAdvice = pickStrings(record.healthAdvice, 3, {
    minLength: TIANJI_TEXT_LIMITS.healthAdvice.min,
    maxLength: TIANJI_TEXT_LIMITS.healthAdvice.max
  });
  const dos = pickStrings(record.dos, 2, {
    minLength: TIANJI_TEXT_LIMITS.tags.min,
    maxLength: TIANJI_TEXT_LIMITS.tags.max,
    sanitize: sanitizeTag,
    requireTagLike: true
  });
  const donts = pickStrings(record.donts, 2, {
    minLength: TIANJI_TEXT_LIMITS.tags.min,
    maxLength: TIANJI_TEXT_LIMITS.tags.max,
    sanitize: sanitizeTag,
    requireTagLike: true
  });

  if (!mysticSaying || !mysticExplanation || !healthAdvice || !dos || !donts) {
    return null;
  }

  if (
    !isWithinRange(
      mysticSaying,
      TIANJI_TEXT_LIMITS.mysticSaying.min,
      TIANJI_TEXT_LIMITS.mysticSaying.max
    ) ||
    !isWithinRange(
      mysticExplanation,
      TIANJI_TEXT_LIMITS.mysticExplanation.min,
      TIANJI_TEXT_LIMITS.mysticExplanation.max
    ) ||
    containsDisallowedTemplate(mysticSaying) ||
    containsDisallowedTemplate(mysticExplanation)
  ) {
    return null;
  }

  if (
    hasInternalOverlap(healthAdvice) ||
    hasInternalOverlap(dos) ||
    hasInternalOverlap(donts) ||
    hasCrossOverlap(healthAdvice, dos) ||
    hasCrossOverlap(healthAdvice, donts) ||
    hasCrossOverlap(dos, donts)
  ) {
    return null;
  }

  return {
    mysticSaying,
    mysticExplanation,
    healthAdvice: [healthAdvice[0], healthAdvice[1], healthAdvice[2]],
    dos: [dos[0], dos[1]],
    donts: [donts[0], donts[1]]
  };
}
