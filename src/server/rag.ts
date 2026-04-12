import OpenAI from "openai";

import {
  constitutionLabels,
  headSenseLabels,
  healthTagLabels,
  moodDescriptions,
  moodLabels,
  sleepDurationLabels,
  tongueCoatingLabels
} from "../shared/labels.js";
import type {
  Constitution,
  DailySupplement,
  HealthTag,
  KnowledgeEntry,
  Mood
} from "../types.js";
import type { ServerEnv } from "./env.js";
import { KNOWLEDGE_ENTRIES } from "./knowledge-data.js";
import { SOLAR_TERMS } from "./solarTerms.js";

export type KnowledgeRetrievalMode = "rules" | "hybrid";
export type KnowledgeVectorStrategy = "embedding" | "chat_signature" | "mock_hash";

export type KnowledgeRetrievalContext = {
  solarTermKey: string;
  constitution: Constitution;
  mood: Mood;
  healthTags: HealthTag[];
  dailySupplement: DailySupplement;
};

export type KnowledgeEmbeddingIndexItem = {
  id: string;
  searchText: string;
  embedding: number[];
};

export type KnowledgeEmbeddingIndex = {
  version: number;
  strategy: KnowledgeVectorStrategy;
  model: string;
  generatedAt: string;
  itemCount: number;
  dimension: number;
  items: KnowledgeEmbeddingIndexItem[];
};

type SemanticSignatureBatchItem = {
  id: string;
  scores: number[];
};

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const MOCK_HASH_DIMENSION = 64;
const CHAT_SIGNATURE_BATCH_SIZE = 8;

const knowledgeCategoryLabels: Record<KnowledgeEntry["category"], string> = {
  seasonal: "节气",
  diet: "饮食",
  sleep: "睡眠",
  exercise: "运动",
  emotion: "情绪"
};

const solarTermNameByKey = new Map(SOLAR_TERMS.map((item) => [item.key, item.name]));
const solarTermSeasonByKey = new Map(SOLAR_TERMS.map((item) => [item.key, item.season]));

const SEMANTIC_SIGNATURE_FEATURES = [
  {
    key: "season.spring_growth_outdoor",
    description: "春季舒展、外出走动、慢慢提起节奏"
  },
  {
    key: "season.summer_heat_cooling",
    description: "夏季降躁、避热、补水、减少过劳"
  },
  {
    key: "season.autumn_dryness_balance",
    description: "秋季润燥、收敛、稳住作息和饮食"
  },
  {
    key: "season.winter_warmth_storage",
    description: "冬季保暖、收藏、减少消耗"
  },
  {
    key: "category.seasonal",
    description: "节气类建议"
  },
  {
    key: "category.diet",
    description: "饮食与补水类建议"
  },
  {
    key: "category.sleep",
    description: "睡眠和晚间收尾类建议"
  },
  {
    key: "category.exercise",
    description: "步行、舒展、活动量调整类建议"
  },
  {
    key: "category.emotion",
    description: "情绪缓冲、减少刺激类建议"
  },
  {
    key: "constitution.balanced",
    description: "平和体质相关"
  },
  {
    key: "constitution.qi_deficiency",
    description: "气虚、容易疲惫、需要收回消耗"
  },
  {
    key: "constitution.yang_deficiency",
    description: "阳虚、偏冷、需要保暖"
  },
  {
    key: "constitution.yin_deficiency",
    description: "阴虚、偏燥、需要降燥和节制刺激"
  },
  {
    key: "constitution.qi_stagnation",
    description: "气滞、情绪郁结、需要疏解"
  },
  {
    key: "constitution.phlegm_dampness",
    description: "痰湿、发沉、需要清淡和活动"
  },
  {
    key: "mood.happy",
    description: "愉快、状态轻盈但不宜过度加码"
  },
  {
    key: "mood.calm",
    description: "平静、适合按部就班"
  },
  {
    key: "mood.tired",
    description: "疲惫、需要恢复和早收尾"
  },
  {
    key: "mood.anxious",
    description: "焦虑、需要减少刺激和拆小任务"
  },
  {
    key: "mood.sad",
    description: "低落、需要降低强度和轻量活动"
  },
  {
    key: "mood.angry",
    description: "烦躁、需要收束情绪和撤掉点火环境"
  },
  {
    key: "tag.late_sleep",
    description: "经常熬夜、夜间输入过多"
  },
  {
    key: "tag.sedentary",
    description: "久坐、活动不足"
  },
  {
    key: "tag.irregular_diet",
    description: "饮食不规律、脾胃负担"
  },
  {
    key: "tag.regular_exercise",
    description: "规律运动、需要调节训练强度"
  },
  {
    key: "intent.sleep_cleanup",
    description: "提前收尾、减少睡前刺激、保证连续睡眠"
  },
  {
    key: "intent.regular_meals_digestive_ease",
    description: "规律进食、减轻脾胃负担、少重口"
  },
  {
    key: "intent.hydration_reduce_stimulating_food",
    description: "补水、减少酒精辛辣高糖或夜宵"
  },
  {
    key: "intent.light_walk_body_unfolding",
    description: "散步、轻量活动、舒展身体"
  },
  {
    key: "intent.break_up_sitting",
    description: "打断久坐、起身活动"
  },
  {
    key: "intent.training_adjustment_recovery",
    description: "训练减量、改成恢复性活动"
  },
  {
    key: "intent.emotion_deescalation_reduce_stimulation",
    description: "放慢呼吸、减少刺激、缓冲情绪"
  },
  {
    key: "intent.warmth_cold_avoidance",
    description: "保暖、少生冷、避免受寒"
  },
  {
    key: "intent.cooling_heat_avoidance",
    description: "避热、降躁、避免过热"
  },
  {
    key: "intent.workload_decompression",
    description: "任务做减法、减少加班、留出缓冲"
  }
] as const;

const semanticFeatureIndex: Map<string, number> = new Map(
  SEMANTIC_SIGNATURE_FEATURES.map((feature, index) => [feature.key, index])
);

export const KNOWLEDGE_EMBEDDING_INDEX_VERSION = 2;

function normalizeOpenAiCompatibleBaseUrl(rawBaseUrl: string): string {
  const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/u, "");

  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl.slice(0, -"/chat/completions".length);
  }

  if (normalizedBaseUrl.endsWith("/responses")) {
    return normalizedBaseUrl.slice(0, -"/responses".length);
  }

  return normalizedBaseUrl;
}

function getOpenAiBaseUrl(env: ServerEnv): string {
  return normalizeOpenAiCompatibleBaseUrl(env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1");
}

function buildOpenAiClient(env: ServerEnv): OpenAI {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to build or query the knowledge index.");
  }

  return new OpenAI({
    apiKey,
    baseURL: getOpenAiBaseUrl(env),
    timeout: 20_000,
    maxRetries: 0
  });
}

function normalizeVector(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, item) => sum + item * item, 0));
  if (magnitude === 0) {
    return values.map(() => 0);
  }

  return values.map((item) => Number((item / magnitude).toFixed(6)));
}

function addVectorWeight(vector: number[], key: string, amount: number) {
  const index = semanticFeatureIndex.get(key);
  if (index === undefined) {
    return;
  }

  vector[index] = (vector[index] ?? 0) + amount;
}

function getSolarTermName(solarTermKey: string): string {
  return solarTermNameByKey.get(solarTermKey) ?? solarTermKey;
}

function getSolarTermSeason(solarTermKey: string): "spring" | "summer" | "autumn" | "winter" {
  return solarTermSeasonByKey.get(solarTermKey) ?? "spring";
}

function describeMoodIntent(mood: Mood): string {
  if (mood === "tired") {
    return "优先恢复体力、降低负荷、稳住睡眠。";
  }

  if (mood === "anxious") {
    return "优先减少刺激、收束情绪、拆小任务。";
  }

  if (mood === "angry") {
    return "优先撤掉继续点火的环境，减少争执和辛辣酒精。";
  }

  if (mood === "sad") {
    return "优先降低强度，增加轻量活动和规律作息。";
  }

  if (mood === "happy") {
    return "优先稳定节奏，不要因为状态轻快而过度加码。";
  }

  return "优先保持节奏平衡，把饮食、运动和休息安顿到位。";
}

function describeHealthTagIntent(healthTags: HealthTag[]): string[] {
  const intents: string[] = [];

  if (healthTags.includes("late_sleep")) {
    intents.push("需要提前收尾、减少睡前刺激、把睡眠往前提。");
  }

  if (healthTags.includes("sedentary")) {
    intents.push("需要打断久坐、增加低负担步行和舒展。");
  }

  if (healthTags.includes("irregular_diet")) {
    intents.push("需要恢复三餐规律、减少夜宵和重口。");
  }

  if (healthTags.includes("regular_exercise")) {
    intents.push("需要根据当天状态调节训练强度，而不是继续加量。");
  }

  return intents;
}

function describeSupplementIntent(supplement: DailySupplement): string[] {
  const intents: string[] = [];

  if (supplement.sleepDuration === "short") {
    intents.push("昨夜睡眠偏短，需要把恢复、早收尾和减少刺激放到更前面。");
  } else if (supplement.sleepDuration === "long") {
    intents.push("睡眠时长相对充足，建议以稳态修整为主，不必额外加码。");
  }

  if (supplement.headSense === "slightly_full") {
    intents.push("头面体感略有发胀，更适合减少连续输入、放慢呼吸和控制辛辣酒精。");
  } else if (supplement.headSense === "rising") {
    intents.push("头面体感有些上冲，需要优先降躁、减少争执和刺激性饮食。");
  }

  if (supplement.tongueCoating === "thick_white") {
    intents.push("舌苔观感偏白偏厚，建议倾向清淡热食、少夜宵、少油腻。");
  } else if (supplement.tongueCoating === "slightly_yellow") {
    intents.push("舌苔观感微黄，建议优先补水、少辛辣酒精和减少熬夜。");
  }

  return intents;
}

function getChatSignatureModel(env: ServerEnv): string {
  return env.OPENAI_SIGNATURE_MODEL?.trim() || env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function batchItems<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

function createMockHashVector(text: string, dimension = MOCK_HASH_DIMENSION): number[] {
  const normalized = text
    .replace(/\s+/gu, "")
    .replace(/[，。！？；：、,.!?;:()（）"'`-]/gu, "");
  const vector = new Array<number>(dimension).fill(0);

  if (!normalized) {
    return vector;
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const token = normalized.slice(index, Math.min(normalized.length, index + 2));
    let hash = 2166136261;

    for (const char of token) {
      hash ^= char.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16777619);
    }

    const slot = Math.abs(hash) % dimension;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[slot] += sign;
  }

  return normalizeVector(vector);
}

function buildSemanticSignatureSystemPrompt() {
  return [
    "你负责把生活方式知识条目压缩成固定长度的语义签名。",
    "你会看到一个固定特征表，请为每条输入内容在每个特征上打分。",
    "分值只允许 0、1、2、3：",
    "0 表示几乎无关，1 表示轻微相关，2 表示明显相关，3 表示核心主题。",
    "必须根据整体语义打分，不要只看关键词。",
    "必须输出合法 JSON。"
  ].join("\n");
}

function buildSemanticSignatureUserPrompt(batch: Array<{ id: string; text: string }>): string {
  const featureLines = SEMANTIC_SIGNATURE_FEATURES.map(
    (feature, index) => `${index + 1}. ${feature.key}: ${feature.description}`
  ).join("\n");
  const itemLines = batch
    .map(
      (item, index) =>
        `### 输入 ${index + 1}\n- id: ${item.id}\n- text:\n${item.text}`
    )
    .join("\n\n");

  return [
    "请对以下输入逐条生成语义签名。",
    `特征数量固定为 ${SEMANTIC_SIGNATURE_FEATURES.length}，scores 数组顺序必须严格对应以下特征表：`,
    featureLines,
    "",
    "输出要求：",
    "- items 数组长度必须与输入条数一致",
    "- 每个元素都包含 id 和 scores",
    `- scores 必须是长度为 ${SEMANTIC_SIGNATURE_FEATURES.length} 的整数数组`,
    "- 不要输出解释",
    "",
    itemLines
  ].join("\n");
}

function buildSemanticSignatureSchema(batchSize: number) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        minItems: batchSize,
        maxItems: batchSize,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            scores: {
              type: "array",
              minItems: SEMANTIC_SIGNATURE_FEATURES.length,
              maxItems: SEMANTIC_SIGNATURE_FEATURES.length,
              items: {
                type: "integer",
                minimum: 0,
                maximum: 3
              }
            }
          },
          required: ["id", "scores"]
        }
      }
    },
    required: ["items"]
  } as const;
}

function ensureSemanticBatchItems(
  value: unknown,
  expectedIds: string[]
): SemanticSignatureBatchItem[] {
  if (!value || typeof value !== "object") {
    throw new Error("Chat signature response was not an object.");
  }

  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length !== expectedIds.length) {
    throw new Error("Chat signature response item count did not match the request batch.");
  }

  const ids = new Set(expectedIds);

  return items.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Chat signature response contained an invalid item.");
    }

    const id = (item as { id?: unknown }).id;
    const scores = (item as { scores?: unknown }).scores;

    if (typeof id !== "string" || !ids.has(id)) {
      throw new Error(`Chat signature response contained an unexpected id: ${String(id)}.`);
    }

    if (
      !Array.isArray(scores) ||
      scores.length !== SEMANTIC_SIGNATURE_FEATURES.length ||
      !scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 3)
    ) {
      throw new Error(`Chat signature response contained invalid scores for ${id}.`);
    }

    return {
      id,
      scores: scores as number[]
    };
  });
}

async function createSemanticSignatureBatch(
  client: OpenAI,
  model: string,
  batch: Array<{ id: string; text: string }>
): Promise<SemanticSignatureBatchItem[]> {
  const response = await client.responses.create({
    model,
    temperature: 0,
    instructions: buildSemanticSignatureSystemPrompt(),
    input: buildSemanticSignatureUserPrompt(batch),
    text: {
      format: {
        type: "json_schema",
        name: "knowledge_signature_batch",
        strict: true,
        schema: buildSemanticSignatureSchema(batch.length)
      }
    }
  });

  const text = response.output_text.trim();
  if (!text) {
    throw new Error("Chat signature response was empty.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Chat signature response was not valid JSON.");
  }

  return ensureSemanticBatchItems(payload, batch.map((item) => item.id));
}

async function createChatSignatureIndex(
  env: ServerEnv,
  entries: KnowledgeEntry[] = KNOWLEDGE_ENTRIES
): Promise<KnowledgeEmbeddingIndex> {
  const client = buildOpenAiClient(env);
  const model = getChatSignatureModel(env);
  const items: KnowledgeEmbeddingIndexItem[] = [];

  for (const batch of batchItems(
    entries.map((entry) => ({
      id: entry.id,
      text: buildKnowledgeEmbeddingText(entry)
    })),
    CHAT_SIGNATURE_BATCH_SIZE
  )) {
    const signatureBatch = await createSemanticSignatureBatch(client, model, batch);
    const byId = new Map(signatureBatch.map((item) => [item.id, item.scores]));

    batch.forEach((item) => {
      const scores = byId.get(item.id);
      if (!scores) {
        throw new Error(`Missing semantic signature for ${item.id}.`);
      }

      items.push({
        id: item.id,
        searchText: item.text,
        embedding: normalizeVector(scores)
      });
    });
  }

  return {
    version: KNOWLEDGE_EMBEDDING_INDEX_VERSION,
    strategy: "chat_signature",
    model,
    generatedAt: new Date().toISOString(),
    itemCount: entries.length,
    dimension: SEMANTIC_SIGNATURE_FEATURES.length,
    items
  };
}

function createMockHashIndex(
  entries: KnowledgeEntry[] = KNOWLEDGE_ENTRIES
): KnowledgeEmbeddingIndex {
  return {
    version: KNOWLEDGE_EMBEDDING_INDEX_VERSION,
    strategy: "mock_hash",
    model: "local-mock-hash",
    generatedAt: new Date().toISOString(),
    itemCount: entries.length,
    dimension: MOCK_HASH_DIMENSION,
    items: entries.map((entry) => {
      const searchText = buildKnowledgeEmbeddingText(entry);
      return {
        id: entry.id,
        searchText,
        embedding: createMockHashVector(searchText)
      };
    })
  };
}

export function getEmbeddingModel(env: ServerEnv): string {
  return env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

export function getRetrievalMode(env: ServerEnv): KnowledgeRetrievalMode {
  return env.RAG_RETRIEVAL_MODE === "rules" ? "rules" : "hybrid";
}

export function buildKnowledgeEmbeddingText(entry: KnowledgeEntry): string {
  const solarTerms =
    entry.tags.solarTerms.length > 0
      ? entry.tags.solarTerms.map(getSolarTermName).join("、")
      : "通用";
  const constitutions = entry.tags.constitutions.map((item) => constitutionLabels[item]).join("、");
  const moods = entry.tags.moods.map((item) => moodLabels[item]).join("、");
  const healthTags =
    entry.tags.healthTags.length > 0
      ? entry.tags.healthTags.map((item) => healthTagLabels[item]).join("、")
      : "无";

  return [
    `知识编号：${entry.id}`,
    `类别：${knowledgeCategoryLabels[entry.category]}`,
    `来源：${entry.sourceTitle} / ${entry.sourceSection}`,
    `摘要：${entry.summary}`,
    `建议动作：${entry.actionItems.join("；")}`,
    `避免事项：${entry.avoidItems.join("；") || "无"}`,
    `适用节气：${solarTerms}`,
    `适用体质：${constitutions}`,
    `适用情绪：${moods}`,
    `适用生活标签：${healthTags}`
  ].join("\n");
}

export function buildKnowledgeQueryText(context: KnowledgeRetrievalContext): string {
  const healthTags =
    context.healthTags.length > 0
      ? context.healthTags.map((item) => healthTagLabels[item]).join("、")
      : "无";
  const tagIntent = describeHealthTagIntent(context.healthTags);
  const supplementIntent = describeSupplementIntent(context.dailySupplement);

  return [
    "为今日天机卡检索更贴合的生活方式建议。",
    `当前节气：${getSolarTermName(context.solarTermKey)}`,
    `体质类型：${constitutionLabels[context.constitution]}`,
    `今日状态：${moodLabels[context.mood]}，${moodDescriptions[context.mood]}`,
    `生活标签：${healthTags}`,
    `补录体感：头面 ${headSenseLabels[context.dailySupplement.headSense]}；睡眠 ${
      sleepDurationLabels[context.dailySupplement.sleepDuration]
    }；舌苔 ${tongueCoatingLabels[context.dailySupplement.tongueCoating]}`,
    `优先意图：${describeMoodIntent(context.mood)}`,
    ...(tagIntent.length > 0 ? tagIntent.map((line) => `补充意图：${line}`) : []),
    ...(supplementIntent.length > 0 ? supplementIntent.map((line) => `补录意图：${line}`) : []),
    "目标：找到更适合今天执行的低风险建议，兼顾节气动作、个人状态和恢复动作。"
  ].join("\n");
}

function buildQuerySemanticSignature(context: KnowledgeRetrievalContext): number[] {
  const vector = new Array<number>(SEMANTIC_SIGNATURE_FEATURES.length).fill(0);

  addVectorWeight(vector, "category.seasonal", 2.5);

  const season = getSolarTermSeason(context.solarTermKey);
  if (season === "spring") {
    addVectorWeight(vector, "season.spring_growth_outdoor", 3);
    addVectorWeight(vector, "intent.light_walk_body_unfolding", 1.2);
  } else if (season === "summer") {
    addVectorWeight(vector, "season.summer_heat_cooling", 3);
    addVectorWeight(vector, "intent.cooling_heat_avoidance", 1.4);
    addVectorWeight(vector, "intent.hydration_reduce_stimulating_food", 1.2);
  } else if (season === "autumn") {
    addVectorWeight(vector, "season.autumn_dryness_balance", 3);
    addVectorWeight(vector, "intent.regular_meals_digestive_ease", 1.1);
  } else {
    addVectorWeight(vector, "season.winter_warmth_storage", 3);
    addVectorWeight(vector, "intent.warmth_cold_avoidance", 1.5);
    addVectorWeight(vector, "intent.sleep_cleanup", 0.8);
  }

  addVectorWeight(vector, `constitution.${context.constitution}`, 2.4);
  addVectorWeight(vector, `mood.${context.mood}`, 3);

  context.healthTags.forEach((tag) => {
    addVectorWeight(vector, `tag.${tag}`, 2.3);
  });

  if (context.mood === "anxious" || context.mood === "angry") {
    addVectorWeight(vector, "category.emotion", 2.5);
    addVectorWeight(vector, "category.sleep", 2);
    addVectorWeight(vector, "category.diet", 1.4);
    addVectorWeight(vector, "intent.emotion_deescalation_reduce_stimulation", 3);
    addVectorWeight(vector, "intent.workload_decompression", 2);
    addVectorWeight(vector, "intent.sleep_cleanup", 1.5);
  } else if (context.mood === "sad") {
    addVectorWeight(vector, "category.emotion", 2.4);
    addVectorWeight(vector, "category.exercise", 2.2);
    addVectorWeight(vector, "category.sleep", 1.8);
    addVectorWeight(vector, "intent.light_walk_body_unfolding", 2.4);
    addVectorWeight(vector, "intent.emotion_deescalation_reduce_stimulation", 2.1);
  } else if (context.mood === "tired") {
    addVectorWeight(vector, "category.sleep", 2.8);
    addVectorWeight(vector, "category.exercise", context.healthTags.includes("sedentary") ? 2.6 : 2);
    addVectorWeight(vector, "category.diet", 1.4);
    addVectorWeight(vector, "intent.sleep_cleanup", 3);
    addVectorWeight(vector, "intent.training_adjustment_recovery", 2.2);
    addVectorWeight(vector, "intent.workload_decompression", 1.8);
  } else if (context.healthTags.includes("irregular_diet")) {
    addVectorWeight(vector, "category.diet", 3);
    addVectorWeight(vector, "category.sleep", 1.4);
  } else if (context.healthTags.includes("regular_exercise")) {
    addVectorWeight(vector, "category.exercise", 2.8);
    addVectorWeight(vector, "category.diet", 1.5);
  } else {
    addVectorWeight(vector, "category.diet", 1.6);
    addVectorWeight(vector, "category.exercise", 1.6);
    addVectorWeight(vector, "category.sleep", 1.4);
  }

  if (context.healthTags.includes("late_sleep")) {
    addVectorWeight(vector, "category.sleep", 1.8);
    addVectorWeight(vector, "intent.sleep_cleanup", 3);
    addVectorWeight(vector, "intent.workload_decompression", 1.1);
  }

  if (context.healthTags.includes("sedentary")) {
    addVectorWeight(vector, "category.exercise", 2);
    addVectorWeight(vector, "intent.break_up_sitting", 3);
    addVectorWeight(vector, "intent.light_walk_body_unfolding", 2);
  }

  if (context.healthTags.includes("irregular_diet")) {
    addVectorWeight(vector, "category.diet", 2.4);
    addVectorWeight(vector, "intent.regular_meals_digestive_ease", 3);
    addVectorWeight(vector, "intent.hydration_reduce_stimulating_food", 1.8);
  }

  if (context.healthTags.includes("regular_exercise")) {
    addVectorWeight(vector, "category.exercise", 1.6);
    addVectorWeight(vector, "intent.training_adjustment_recovery", 3);
  }

  if (context.constitution === "yang_deficiency") {
    addVectorWeight(vector, "intent.warmth_cold_avoidance", 2.4);
  }

  if (context.constitution === "yin_deficiency") {
    addVectorWeight(vector, "intent.cooling_heat_avoidance", 1.8);
    addVectorWeight(vector, "intent.hydration_reduce_stimulating_food", 1.2);
  }

  if (context.constitution === "phlegm_dampness") {
    addVectorWeight(vector, "intent.regular_meals_digestive_ease", 1.8);
    addVectorWeight(vector, "intent.light_walk_body_unfolding", 1.5);
  }

  if (context.constitution === "qi_stagnation") {
    addVectorWeight(vector, "intent.emotion_deescalation_reduce_stimulation", 1.6);
    addVectorWeight(vector, "intent.light_walk_body_unfolding", 1.1);
  }

  if (context.dailySupplement.sleepDuration === "short") {
    addVectorWeight(vector, "category.sleep", 2.8);
    addVectorWeight(vector, "category.emotion", 1.2);
    addVectorWeight(vector, "intent.sleep_cleanup", 3);
    addVectorWeight(vector, "intent.workload_decompression", 1.7);
  } else if (context.dailySupplement.sleepDuration === "long") {
    addVectorWeight(vector, "category.exercise", 0.8);
    addVectorWeight(vector, "intent.training_adjustment_recovery", 1.2);
  }

  if (context.dailySupplement.headSense === "slightly_full") {
    addVectorWeight(vector, "category.emotion", 1.6);
    addVectorWeight(vector, "category.diet", 1.4);
    addVectorWeight(vector, "intent.emotion_deescalation_reduce_stimulation", 2.3);
    addVectorWeight(vector, "intent.hydration_reduce_stimulating_food", 1.6);
  } else if (context.dailySupplement.headSense === "rising") {
    addVectorWeight(vector, "category.emotion", 2.1);
    addVectorWeight(vector, "category.diet", 1.8);
    addVectorWeight(vector, "intent.emotion_deescalation_reduce_stimulation", 2.8);
    addVectorWeight(vector, "intent.cooling_heat_avoidance", 2);
    addVectorWeight(vector, "intent.hydration_reduce_stimulating_food", 2.2);
  }

  if (context.dailySupplement.tongueCoating === "thick_white") {
    addVectorWeight(vector, "category.diet", 2.6);
    addVectorWeight(vector, "intent.regular_meals_digestive_ease", 2.8);
  } else if (context.dailySupplement.tongueCoating === "slightly_yellow") {
    addVectorWeight(vector, "category.diet", 2.4);
    addVectorWeight(vector, "intent.hydration_reduce_stimulating_food", 3);
    addVectorWeight(vector, "intent.cooling_heat_avoidance", 1.3);
  }

  return normalizeVector(vector);
}

export function isKnowledgeEmbeddingIndexUsable(
  index: KnowledgeEmbeddingIndex,
  entries: KnowledgeEntry[] = KNOWLEDGE_ENTRIES
): boolean {
  if (
    index.version !== KNOWLEDGE_EMBEDDING_INDEX_VERSION ||
    index.itemCount <= 0 ||
    index.items.length !== index.itemCount ||
    index.dimension <= 0
  ) {
    return false;
  }

  const knownEntryIds = new Set(entries.map((entry) => entry.id));

  return index.items.every(
    (item) =>
      knownEntryIds.has(item.id) &&
      item.embedding.length === index.dimension &&
      item.embedding.some((value) => value !== 0)
  );
}

export async function embedQueryText(
  queryText: string,
  env: ServerEnv
): Promise<{ embedding: number[]; model: string }> {
  const client = buildOpenAiClient(env);
  const model = getEmbeddingModel(env);
  const response = await client.embeddings.create({
    model,
    input: queryText
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error("Embedding response did not contain a usable vector.");
  }

  return {
    embedding,
    model
  };
}

export async function buildQueryVector(
  context: KnowledgeRetrievalContext,
  queryText: string,
  env: ServerEnv,
  index: KnowledgeEmbeddingIndex
): Promise<{ vector: number[]; strategy: KnowledgeVectorStrategy; model: string }> {
  if (index.strategy === "embedding") {
    const result = await embedQueryText(queryText, env);
    return {
      vector: result.embedding,
      strategy: "embedding",
      model: result.model
    };
  }

  if (index.strategy === "chat_signature") {
    return {
      vector: buildQuerySemanticSignature(context),
      strategy: "chat_signature",
      model: index.model
    };
  }

  return {
    vector: createMockHashVector(queryText, index.dimension),
    strategy: "mock_hash",
    model: index.model
  };
}

export async function createKnowledgeEmbeddingIndex(
  env: ServerEnv,
  entries: KnowledgeEntry[] = KNOWLEDGE_ENTRIES
): Promise<KnowledgeEmbeddingIndex> {
  const embeddingModel = getEmbeddingModel(env);

  try {
    const client = buildOpenAiClient(env);
    const searchTexts = entries.map((entry) => buildKnowledgeEmbeddingText(entry));
    const response = await client.embeddings.create({
      model: embeddingModel,
      input: searchTexts
    });

    if (response.data.length !== entries.length) {
      throw new Error(
        `Embedding count mismatch: expected ${entries.length}, received ${response.data.length}.`
      );
    }

    const dimension = response.data[0]?.embedding?.length ?? 0;
    if (dimension <= 0) {
      throw new Error("Embedding response did not contain usable vectors.");
    }

    return {
      version: KNOWLEDGE_EMBEDDING_INDEX_VERSION,
      strategy: "embedding",
      model: embeddingModel,
      generatedAt: new Date().toISOString(),
      itemCount: entries.length,
      dimension,
      items: entries.map((entry, index) => ({
        id: entry.id,
        searchText: searchTexts[index],
        embedding: response.data[index]?.embedding ?? []
      }))
    };
  } catch (embeddingError) {
    try {
      return await createChatSignatureIndex(env, entries);
    } catch (chatSignatureError) {
      console.warn(
        `[rag] falling back to mock hash index ${JSON.stringify({
          embeddingError:
            embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
          chatSignatureError:
            chatSignatureError instanceof Error ? chatSignatureError.message : String(chatSignatureError)
        })}`
      );
      return createMockHashIndex(entries);
    }
  }
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function serializeKnowledgeEmbeddingIndex(index: KnowledgeEmbeddingIndex): string {
  return [
    'import type { KnowledgeEmbeddingIndex } from "./rag.js";',
    "",
    "export const KNOWLEDGE_EMBEDDING_INDEX: KnowledgeEmbeddingIndex = ",
    `${JSON.stringify(index, null, 2)};`,
    ""
  ].join("\n");
}
