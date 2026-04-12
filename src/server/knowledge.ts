import type { KnowledgeEntry } from "../types.js";
import { KNOWLEDGE_ENTRIES } from "./knowledge-data.js";
import {
  cosineSimilarity,
  type KnowledgeEmbeddingIndex,
  type KnowledgeRetrievalContext,
  type KnowledgeRetrievalMode,
  isKnowledgeEmbeddingIndexUsable
} from "./rag.js";

type KnowledgeCategory = KnowledgeEntry["category"];

export type KnowledgeContext = KnowledgeRetrievalContext;

type RetrievalFallbackReason =
  | "index_unavailable"
  | "query_embedding_missing"
  | "query_embedding_dimension_mismatch";

export type KnowledgeSelectionOptions = {
  retrievalMode?: KnowledgeRetrievalMode;
  embeddingIndex?: KnowledgeEmbeddingIndex;
  queryEmbedding?: number[];
  queryText?: string;
};

type KnowledgeSignals = {
  seasonalMatch: boolean;
  constitutionMatch: boolean;
  moodMatch: boolean;
  healthTagHits: number;
};

type ScoredKnowledgeEntry = {
  entry: KnowledgeEntry;
  ruleScore: number;
  score: number;
  vectorScore: number;
  vectorBoost: number;
  signals: KnowledgeSignals;
};

export type KnowledgeSelectionDiagnostics = {
  requestedSolarTermKey: string;
  requestedRetrievalMode: KnowledgeRetrievalMode;
  effectiveRetrievalMode: KnowledgeRetrievalMode;
  retrievalFallbackReason?: RetrievalFallbackReason;
  vectorQueryText?: string;
  vectorEligibleCount: number;
  vectorCandidateIds: string[];
  vectorSelectedIds: string[];
  seasonalMatchFound: boolean;
  targetedCategories: KnowledgeCategory[];
  recoveryCategories: KnowledgeCategory[];
  selectedEntryIds: string[];
  scored: Array<{
    id: string;
    category: KnowledgeCategory;
    ruleScore: number;
    score: number;
    vectorScore: number;
    vectorBoost: number;
    seasonalMatch: boolean;
    constitutionMatch: boolean;
    moodMatch: boolean;
    healthTagHits: number;
  }>;
};

export type KnowledgeSelection = {
  seasonal?: KnowledgeEntry;
  targeted?: KnowledgeEntry;
  recovery?: KnowledgeEntry;
  supplemental: KnowledgeEntry[];
  entries: KnowledgeEntry[];
  diagnostics: KnowledgeSelectionDiagnostics;
};

function getTargetCategories(context: KnowledgeContext): KnowledgeCategory[] {
  if (context.mood === "anxious" || context.mood === "angry") {
    return ["emotion", "sleep", "diet", "exercise"];
  }

  if (context.mood === "sad") {
    return ["emotion", "exercise", "sleep", "diet"];
  }

  if (context.mood === "tired") {
    return context.healthTags.includes("sedentary")
      ? ["exercise", "sleep", "diet", "emotion"]
      : ["sleep", "exercise", "diet", "emotion"];
  }

  if (context.healthTags.includes("irregular_diet")) {
    return ["diet", "sleep", "exercise", "emotion"];
  }

  if (context.healthTags.includes("regular_exercise")) {
    return ["exercise", "diet", "sleep", "emotion"];
  }

  return ["diet", "exercise", "sleep", "emotion"];
}

function getRecoveryCategories(context: KnowledgeContext): KnowledgeCategory[] {
  if (context.healthTags.includes("late_sleep")) {
    return ["sleep", "diet", "exercise", "emotion"];
  }

  if (context.healthTags.includes("irregular_diet")) {
    return ["diet", "sleep", "exercise", "emotion"];
  }

  if (context.healthTags.includes("sedentary")) {
    return ["exercise", "sleep", "diet", "emotion"];
  }

  return ["sleep", "diet", "exercise", "emotion"];
}

function buildSignals(
  entry: KnowledgeEntry,
  context: KnowledgeContext
): KnowledgeSignals {
  return {
    seasonalMatch: entry.tags.solarTerms.includes(context.solarTermKey),
    constitutionMatch: entry.tags.constitutions.includes(context.constitution),
    moodMatch: entry.tags.moods.includes(context.mood),
    healthTagHits: context.healthTags.filter((tag) => entry.tags.healthTags.includes(tag)).length
  };
}

function getEntryScore(entry: KnowledgeEntry, signals: KnowledgeSignals): number {
  return (
    (signals.seasonalMatch ? 10 : 0) +
    (signals.moodMatch ? 6 : 0) +
    signals.healthTagHits * 4 +
    (signals.constitutionMatch ? 2 : 0) +
    entry.priority
  );
}

function compareScoredEntries(left: ScoredKnowledgeEntry, right: ScoredKnowledgeEntry): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.ruleScore !== left.ruleScore) {
    return right.ruleScore - left.ruleScore;
  }

  if (right.entry.priority !== left.entry.priority) {
    return right.entry.priority - left.entry.priority;
  }

  return left.entry.id.localeCompare(right.entry.id);
}

type VectorMatch = {
  similarity: number;
  boost: number;
};

type VectorRankingResult = {
  matches: Map<string, VectorMatch>;
  candidateIds: string[];
  eligibleCount: number;
  fallbackReason?: RetrievalFallbackReason;
};

function getVectorRanking(
  entries: KnowledgeEntry[],
  index: KnowledgeEmbeddingIndex | undefined,
  queryEmbedding: number[] | undefined
): VectorRankingResult {
  if (!index || !isKnowledgeEmbeddingIndexUsable(index, entries)) {
    return {
      matches: new Map(),
      candidateIds: [],
      eligibleCount: 0,
      fallbackReason: "index_unavailable"
    };
  }

  if (!queryEmbedding || queryEmbedding.length === 0) {
    return {
      matches: new Map(),
      candidateIds: [],
      eligibleCount: index.items.length,
      fallbackReason: "query_embedding_missing"
    };
  }

  const scoredItems = index.items
    .filter((item) => item.embedding.length === queryEmbedding.length)
    .map((item) => ({
      id: item.id,
      similarity: cosineSimilarity(queryEmbedding, item.embedding)
    }))
    .filter((item) => Number.isFinite(item.similarity))
    .sort((left, right) => right.similarity - left.similarity);

  if (scoredItems.length === 0) {
    return {
      matches: new Map(),
      candidateIds: [],
      eligibleCount: 0,
      fallbackReason: "query_embedding_dimension_mismatch"
    };
  }

  const highestSimilarity = scoredItems[0]?.similarity ?? 0;
  const lowestSimilarity = scoredItems[scoredItems.length - 1]?.similarity ?? 0;
  const similarityRange = highestSimilarity - lowestSimilarity;
  const matches = new Map<string, VectorMatch>();

  scoredItems.forEach((item, indexRank) => {
    const normalizedSimilarity =
      similarityRange > 0
        ? (item.similarity - lowestSimilarity) / similarityRange
        : item.similarity > 0
          ? 1
          : 0;
    const rankBoost = indexRank < 3 ? 3 - indexRank : 0;
    const boost = Math.max(0, normalizedSimilarity * 8 + rankBoost);

    matches.set(item.id, {
      similarity: item.similarity,
      boost
    });
  });

  return {
    matches,
    candidateIds: scoredItems
      .filter((item) => item.similarity > 0)
      .slice(0, 8)
      .map((item) => item.id),
    eligibleCount: scoredItems.length
  };
}

function scoreKnowledgeEntries(
  context: KnowledgeContext,
  options: KnowledgeSelectionOptions
): {
  scored: ScoredKnowledgeEntry[];
  effectiveRetrievalMode: KnowledgeRetrievalMode;
  retrievalFallbackReason?: RetrievalFallbackReason;
  vectorEligibleCount: number;
  vectorCandidateIds: string[];
} {
  const requestedRetrievalMode = options.retrievalMode ?? "rules";
  const vectorRanking =
    requestedRetrievalMode === "hybrid"
      ? getVectorRanking(KNOWLEDGE_ENTRIES, options.embeddingIndex, options.queryEmbedding)
      : {
          matches: new Map<string, VectorMatch>(),
          candidateIds: [],
          eligibleCount: 0
        };

  const effectiveRetrievalMode =
    requestedRetrievalMode === "hybrid" && !vectorRanking.fallbackReason ? "hybrid" : "rules";

  const scored = KNOWLEDGE_ENTRIES.map((entry) => {
    const signals = buildSignals(entry, context);
    const ruleScore = getEntryScore(entry, signals);
    const vectorMatch =
      requestedRetrievalMode === "hybrid" && effectiveRetrievalMode === "hybrid"
        ? vectorRanking.matches.get(entry.id)
        : undefined;

    return {
      entry,
      signals,
      ruleScore,
      vectorScore: vectorMatch?.similarity ?? 0,
      vectorBoost: vectorMatch?.boost ?? 0,
      score: ruleScore + (vectorMatch?.boost ?? 0)
    };
  }).sort(compareScoredEntries);

  return {
    scored,
    effectiveRetrievalMode,
    retrievalFallbackReason:
      requestedRetrievalMode === "hybrid" && effectiveRetrievalMode === "rules"
        ? vectorRanking.fallbackReason
        : undefined,
    vectorEligibleCount: vectorRanking.eligibleCount,
    vectorCandidateIds: vectorRanking.candidateIds
  };
}

function getCategoryBias(category: KnowledgeCategory, preferred: KnowledgeCategory[]): number {
  const index = preferred.indexOf(category);
  if (index === -1) {
    return -12;
  }

  return 24 - index * 5;
}

function getTargetedRank(
  item: ScoredKnowledgeEntry,
  preferredCategories: KnowledgeCategory[],
  usedCategories: Set<KnowledgeCategory>
): number {
  return (
    getCategoryBias(item.entry.category, preferredCategories) +
    (item.signals.moodMatch ? 30 : 0) +
    item.signals.healthTagHits * 18 +
    (item.signals.constitutionMatch ? 8 : 0) +
    (usedCategories.has(item.entry.category) ? -10 : 0) +
    item.score
  );
}

function getRecoveryRank(
  item: ScoredKnowledgeEntry,
  preferredCategories: KnowledgeCategory[],
  usedCategories: Set<KnowledgeCategory>
): number {
  return (
    getCategoryBias(item.entry.category, preferredCategories) +
    item.signals.healthTagHits * 24 +
    (item.signals.moodMatch ? 14 : 0) +
    (item.signals.constitutionMatch ? 10 : 0) +
    (usedCategories.has(item.entry.category) ? -12 : 0) +
    item.score
  );
}

function pickStructuredEntry(
  candidates: ScoredKnowledgeEntry[],
  usedIds: Set<string>,
  preferredCategories: KnowledgeCategory[],
  getRank: (
    item: ScoredKnowledgeEntry,
    preferredCategories: KnowledgeCategory[],
    usedCategories: Set<KnowledgeCategory>
  ) => number
): KnowledgeEntry | undefined {
  const remaining = candidates.filter(
    (item) => item.entry.category !== "seasonal" && !usedIds.has(item.entry.id)
  );

  if (remaining.length === 0) {
    return undefined;
  }

  const usedCategories = new Set(
    candidates
      .filter((item) => usedIds.has(item.entry.id))
      .map((item) => item.entry.category)
  );

  const ranked = [...remaining]
    .map((item) => ({
      item,
      rank: getRank(item, preferredCategories, usedCategories)
    }))
    .sort((left, right) => {
      if (right.rank !== left.rank) {
        return right.rank - left.rank;
      }

      return compareScoredEntries(left.item, right.item);
    });

  const relevant = ranked.find(
    ({ item }) =>
      item.signals.moodMatch ||
      item.signals.healthTagHits > 0 ||
      item.signals.constitutionMatch ||
      item.vectorBoost > 0
  );

  return (relevant ?? ranked[0])?.item.entry;
}

function pickSupplementalEntries(
  candidates: ScoredKnowledgeEntry[],
  usedIds: Set<string>,
  limit: number
): KnowledgeEntry[] {
  const picked: KnowledgeEntry[] = [];
  const usedCategories = new Set<KnowledgeCategory>(
    candidates
      .filter((item) => usedIds.has(item.entry.id))
      .map((item) => item.entry.category)
  );

  for (const candidate of candidates) {
    if (
      candidate.entry.category === "seasonal" ||
      usedIds.has(candidate.entry.id) ||
      candidate.score <= 0
    ) {
      continue;
    }

    if (usedCategories.has(candidate.entry.category) && picked.length < Math.min(limit, 1)) {
      continue;
    }

    picked.push(candidate.entry);
    usedIds.add(candidate.entry.id);
    usedCategories.add(candidate.entry.category);

    if (picked.length >= limit) {
      break;
    }
  }

  if (picked.length >= limit) {
    return picked;
  }

  for (const candidate of candidates) {
    if (
      candidate.entry.category === "seasonal" ||
      usedIds.has(candidate.entry.id) ||
      candidate.score <= 0
    ) {
      continue;
    }

    picked.push(candidate.entry);
    usedIds.add(candidate.entry.id);

    if (picked.length >= limit) {
      break;
    }
  }

  return picked;
}

export function selectKnowledge(
  context: KnowledgeContext,
  options: KnowledgeSelectionOptions = {}
): KnowledgeSelection {
  const requestedRetrievalMode = options.retrievalMode ?? "rules";
  const {
    scored,
    effectiveRetrievalMode,
    retrievalFallbackReason,
    vectorEligibleCount,
    vectorCandidateIds
  } = scoreKnowledgeEntries(context, options);
  const targetedCategories = getTargetCategories(context);
  const recoveryCategories = getRecoveryCategories(context);

  const seasonalCandidate =
    scored.find(
      (item) => item.entry.category === "seasonal" && item.signals.seasonalMatch
    ) ?? scored.find((item) => item.entry.category === "seasonal");

  const seasonal = seasonalCandidate?.entry;
  const usedIds = new Set<string>(seasonal ? [seasonal.id] : []);

  const targeted = pickStructuredEntry(
    scored,
    usedIds,
    targetedCategories,
    getTargetedRank
  );
  if (targeted) {
    usedIds.add(targeted.id);
  }

  const recovery = pickStructuredEntry(
    scored,
    usedIds,
    recoveryCategories,
    getRecoveryRank
  );
  if (recovery) {
    usedIds.add(recovery.id);
  }

  const supplemental = pickSupplementalEntries(scored, usedIds, 2);
  const entries = [seasonal, targeted, recovery, ...supplemental].filter(
    (entry): entry is KnowledgeEntry => Boolean(entry)
  );
  const vectorSelectedIds = entries
    .filter((entry) => {
      const selectedItem = scored.find((item) => item.entry.id === entry.id);
      return Boolean(selectedItem && selectedItem.vectorBoost > 0);
    })
    .map((entry) => entry.id);

  return {
    seasonal,
    targeted,
    recovery,
    supplemental,
    entries,
    diagnostics: {
      requestedSolarTermKey: context.solarTermKey,
      requestedRetrievalMode,
      effectiveRetrievalMode,
      retrievalFallbackReason,
      vectorQueryText: options.queryText,
      vectorEligibleCount,
      vectorCandidateIds,
      vectorSelectedIds,
      seasonalMatchFound: Boolean(
        seasonalCandidate?.entry.category === "seasonal" && seasonalCandidate.signals.seasonalMatch
      ),
      targetedCategories,
      recoveryCategories,
      selectedEntryIds: entries.map((entry) => entry.id),
      scored: scored.map((item) => ({
        id: item.entry.id,
        category: item.entry.category,
        ruleScore: Number(item.ruleScore.toFixed(2)),
        score: Number(item.score.toFixed(2)),
        vectorScore: Number(item.vectorScore.toFixed(4)),
        vectorBoost: Number(item.vectorBoost.toFixed(2)),
        seasonalMatch: item.signals.seasonalMatch,
        constitutionMatch: item.signals.constitutionMatch,
        moodMatch: item.signals.moodMatch,
        healthTagHits: item.signals.healthTagHits
      }))
    }
  };
}

export function retrieveKnowledge(
  context: KnowledgeContext,
  options: KnowledgeSelectionOptions = {}
): KnowledgeEntry[] {
  return selectKnowledge(context, options).entries;
}
