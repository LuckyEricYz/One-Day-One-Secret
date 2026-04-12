import type { Constitution, HealthTag, KnowledgeEntry, Mood } from "../types.js";
import { KNOWLEDGE_ENTRIES } from "./knowledge-data.js";

type KnowledgeCategory = KnowledgeEntry["category"];

export type KnowledgeContext = {
  solarTermKey: string;
  constitution: Constitution;
  mood: Mood;
  healthTags: HealthTag[];
};

type KnowledgeSignals = {
  seasonalMatch: boolean;
  constitutionMatch: boolean;
  moodMatch: boolean;
  healthTagHits: number;
};

type ScoredKnowledgeEntry = {
  entry: KnowledgeEntry;
  score: number;
  signals: KnowledgeSignals;
};

export type KnowledgeSelectionDiagnostics = {
  requestedSolarTermKey: string;
  seasonalMatchFound: boolean;
  targetedCategories: KnowledgeCategory[];
  recoveryCategories: KnowledgeCategory[];
  selectedEntryIds: string[];
  scored: Array<{
    id: string;
    category: KnowledgeCategory;
    score: number;
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

  if (right.entry.priority !== left.entry.priority) {
    return right.entry.priority - left.entry.priority;
  }

  return left.entry.id.localeCompare(right.entry.id);
}

function scoreKnowledgeEntries(context: KnowledgeContext): ScoredKnowledgeEntry[] {
  return KNOWLEDGE_ENTRIES.map((entry) => {
    const signals = buildSignals(entry, context);
    return {
      entry,
      signals,
      score: getEntryScore(entry, signals)
    };
  }).sort(compareScoredEntries);
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
      item.signals.moodMatch || item.signals.healthTagHits > 0 || item.signals.constitutionMatch
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

export function selectKnowledge(context: KnowledgeContext): KnowledgeSelection {
  const scored = scoreKnowledgeEntries(context);
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

  return {
    seasonal,
    targeted,
    recovery,
    supplemental,
    entries,
    diagnostics: {
      requestedSolarTermKey: context.solarTermKey,
      seasonalMatchFound: Boolean(
        seasonalCandidate?.entry.category === "seasonal" && seasonalCandidate.signals.seasonalMatch
      ),
      targetedCategories,
      recoveryCategories,
      selectedEntryIds: entries.map((entry) => entry.id),
      scored: scored.map((item) => ({
        id: item.entry.id,
        category: item.entry.category,
        score: Number(item.score.toFixed(2)),
        seasonalMatch: item.signals.seasonalMatch,
        constitutionMatch: item.signals.constitutionMatch,
        moodMatch: item.signals.moodMatch,
        healthTagHits: item.signals.healthTagHits
      }))
    }
  };
}

export function retrieveKnowledge(context: KnowledgeContext): KnowledgeEntry[] {
  return selectKnowledge(context).entries;
}
