import {
  CONSTITUTIONS,
  HEALTH_TAGS,
  MOODS,
  TONGUE_DIAGNOSIS_OPTIONS,
  type GenerateRequestPayload,
  type TianjiData
} from "../types";
import { SHANGHAI_TIMEZONE } from "../shared/time";

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

function pickStrings(value: unknown, expectedLength: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const next = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  if (next.length < expectedLength) return null;
  return next.slice(0, expectedLength);
}

export function normalizeGeneratedData(
  input: unknown
): Omit<TianjiData, "meta"> | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const mysticSaying =
    typeof record.mysticSaying === "string" ? record.mysticSaying.trim().slice(0, 20) : "";
  const mysticExplanation =
    typeof record.mysticExplanation === "string" ? record.mysticExplanation.trim() : "";
  const healthAdvice = pickStrings(record.healthAdvice, 3);
  const dos = pickStrings(record.dos, 2);
  const donts = pickStrings(record.donts, 2);

  if (!mysticSaying || !mysticExplanation || !healthAdvice || !dos || !donts) {
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

