import type { Constitution, HealthTag, KnowledgeEntry, Mood } from "../types";
import { KNOWLEDGE_ENTRIES } from "./knowledge-data";

export type KnowledgeContext = {
  solarTermKey: string;
  constitution: Constitution;
  mood: Mood;
  healthTags: HealthTag[];
};

export function retrieveKnowledge(context: KnowledgeContext): KnowledgeEntry[] {
  const scored = KNOWLEDGE_ENTRIES.map((entry) => {
    let score = 0;

    if (entry.tags.solarTerms.includes(context.solarTermKey)) score += 4;
    if (entry.tags.constitutions.includes(context.constitution)) score += 3;
    if (entry.tags.moods.includes(context.mood)) score += 2;

    context.healthTags.forEach((tag) => {
      if (entry.tags.healthTags.includes(tag)) score += 1;
    });

    return { entry, score };
  })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.entry.priority !== left.entry.priority) {
        return right.entry.priority - left.entry.priority;
      }
      return left.entry.id.localeCompare(right.entry.id);
    });

  const picked: KnowledgeEntry[] = [];
  const categoryCount = new Map<string, number>();

  for (const item of scored) {
    if (picked.length >= 5) break;

    const currentCount = categoryCount.get(item.entry.category) ?? 0;
    if (currentCount >= 2) continue;

    if (item.score === 0 && picked.length > 0) continue;

    picked.push(item.entry);
    categoryCount.set(item.entry.category, currentCount + 1);
  }

  if (!picked.some((item) => item.category === "seasonal")) {
    const seasonal = scored.find((item) => item.entry.category === "seasonal")?.entry;
    if (seasonal) picked.unshift(seasonal);
  }

  if (!picked.some((item) => item.category === "sleep")) {
    const sleep = scored.find((item) => item.entry.category === "sleep")?.entry;
    if (sleep) picked.push(sleep);
  }

  const unique = Array.from(new Map(picked.map((item) => [item.id, item])).values());
  return unique.slice(0, 5);
}

