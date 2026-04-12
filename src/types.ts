export const CONSTITUTIONS = [
  "balanced",
  "qi_deficiency",
  "yang_deficiency",
  "yin_deficiency",
  "qi_stagnation",
  "phlegm_dampness"
] as const;

export const HEALTH_TAGS = [
  "late_sleep",
  "sedentary",
  "irregular_diet",
  "regular_exercise"
] as const;

export const MOODS = [
  "happy",
  "calm",
  "tired",
  "anxious",
  "sad",
  "angry"
] as const;

export const TONGUE_DIAGNOSIS_OPTIONS = [
  "option_a",
  "option_b",
  "option_c"
] as const;

export type Constitution = (typeof CONSTITUTIONS)[number];
export type HealthTag = (typeof HEALTH_TAGS)[number];
export type Mood = (typeof MOODS)[number];
export type TongueDiagnosis = (typeof TONGUE_DIAGNOSIS_OPTIONS)[number] | null;

export type UserProfile = {
  constitution: Constitution;
  healthTags: HealthTag[];
  todayMood: Mood;
  tongueDiagnosis: TongueDiagnosis;
};

export type StoredProfile = {
  constitution: Constitution;
  healthTags: HealthTag[];
  createdAt: string;
  updatedAt: string;
  version: 1;
};

export type CalendarContext = {
  solarTermKey: string;
  solarTermName: string;
  solarTermStage: "start" | "middle" | "end";
  ganZhiSummary: string;
  dateKey: string;
};

export type HexagramContext = {
  key: string;
  name: string;
  changedName: string | null;
  lines: number[];
  changingLines: number[];
  summary: string;
};

export type KnowledgeEntry = {
  id: string;
  sourceType: "classic" | "guideline";
  sourceTitle: string;
  sourceSection: string;
  category: "seasonal" | "diet" | "sleep" | "exercise" | "emotion";
  summary: string;
  actionItems: string[];
  avoidItems: string[];
  tags: {
    solarTerms: string[];
    constitutions: Constitution[];
    moods: Mood[];
    healthTags: HealthTag[];
  };
  priority: number;
};

export type TianjiMeta = {
  solarTermName: string;
  ganZhiSummary: string;
  hexagramName: string;
  knowledgeIds: string[];
  generatedAt: string;
  provider: "openai" | "gemini" | "kimi" | "fallback";
  isFallback: boolean;
  requestId: string;
  fallbackReasonCode?:
    | "auth"
    | "network"
    | "timeout"
    | "http"
    | "parse"
    | "schema"
    | "provider_unavailable";
};

export type TianjiData = {
  mysticSaying: string;
  mysticExplanation: string;
  healthAdvice: [string, string, string];
  dos: [string, string];
  donts: [string, string];
  meta: TianjiMeta;
};

export type HistoryEntry = {
  id: string;
  date: string;
  mood: Mood;
  result: TianjiData;
};

export type QuotaSnapshot = {
  date: string;
  count: number;
  maxPerDay: number;
};

export type GenerateRequestPayload = {
  clientId: string;
  pressDurationMs: number;
  touchEntropy?: number;
  userProfile: UserProfile;
  context: {
    timestamp: number;
    timezone: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
};

export type GenerateSuccessResponse = {
  success: true;
  data: TianjiData;
  remainingQuota: number;
};

export type GenerateErrorResponse = {
  success: false;
  error: {
    code:
      | "INVALID_INPUT"
      | "PRESS_TOO_SHORT"
      | "RATE_LIMIT_EXCEEDED"
      | "INTERNAL_ERROR";
    message: string;
    retryAfter?: string;
  };
};

export type GenerateResponse = GenerateSuccessResponse | GenerateErrorResponse;

export type QuestionnaireAnswers = {
  bloodPressure: "high" | "low" | "steady";
  sleepDuration: "short" | "normal" | "long";
  tongueCoating: "white_thick" | "red_thin" | "pale_thin";
  healthTags: Array<"sedentary" | "late_sleep" | "irregular_diet" | "regular_exercise">;
};
