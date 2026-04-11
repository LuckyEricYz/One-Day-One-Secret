import type {
  CalendarContext,
  HexagramContext,
  KnowledgeEntry,
  Mood,
  TianjiData,
  UserProfile
} from "../types";
import { moodLabels } from "../shared/labels";
import { normalizeGeneratedData } from "./validate";

type KnowledgeCategory = KnowledgeEntry["category"];

const moodDos: Record<Mood, [string, string]> = {
  happy: ["留出余量", "轻动舒展"],
  calm: ["守时吃饭", "轻动舒展"],
  tired: ["早点收尾", "轻动舒展"],
  anxious: ["缓息定神", "减少刺激"],
  sad: ["热食暖胃", "出门走动"],
  angry: ["先离争执", "降低刺激"]
};

const moodDonts: Record<Mood, [string, string]> = {
  happy: ["兴奋过量", "临时熬夜"],
  calm: ["过量加班", "暴食顶饿"],
  tired: ["熬夜硬撑", "夜里硬练"],
  anxious: ["刷屏过久", "情绪进食"],
  sad: ["整天不吃", "整夜闷着"],
  angry: ["火上加火", "借酒压情"]
};

const moodFocus: Record<Mood, { tail: string; focus: string }> = {
  happy: { tail: "留三分余", focus: "活动量和晚间收尾" },
  calm: { tail: "守常慢行", focus: "作息和活动量" },
  tired: { tail: "先养气力", focus: "睡眠、吃饭和活动强度" },
  anxious: { tail: "先减扰动", focus: "呼吸、输入量和晚间刺激" },
  sad: { tail: "先护起居", focus: "热食、走动和睡前收尾" },
  angry: { tail: "先收躁意", focus: "争执、刺激和晚间兴奋" }
};

const fallbackAdviceDefaults: Record<Mood, [string, string, string]> = {
  happy: [
    "把今天的活动量留三分余地，不必临时再加码",
    "每60-90分钟起身活动几分钟，别一直坐着不动",
    "今晚比平时早一点收尾，让身体慢慢落下来"
  ],
  calm: [
    "按平常节奏把三餐吃稳，不必刻意追求复杂养生",
    "久坐后先起身舒展几分钟，再继续手头事务",
    "睡前让环境慢慢安静下来，给今天留个收口"
  ],
  tired: [
    "把最晚收尾时间前移一点，今晚别再硬往后拖",
    "白天只做轻量活动，不必勉强自己再加训练量",
    "晚餐尽量温热清淡一些，夜里少吃高刺激食物"
  ],
  anxious: [
    "先把呼吸放慢几轮，再去处理眼前最小的一件事",
    "给自己留10分钟无输入时间，先把外界刺激降下来",
    "晚餐清淡一点，睡前尽量少看消息和工作信息"
  ],
  sad: [
    "先吃一顿热食正餐，再处理今天剩下的琐碎事情",
    "白天出门走一小段，让身体重新感到一点流动",
    "今晚早点收尾，给自己留一段安静缓冲的时间"
  ],
  angry: [
    "先离开容易起火的场景，等身体降下来再说话",
    "白天减少辛辣酒精和额外刺激，别继续把火拱高",
    "睡前不再加任务，让今天的收尾尽量轻一点"
  ]
};

const stageSayings: Record<CalendarContext["solarTermStage"], string> = {
  start: "气升",
  middle: "守中",
  end: "轻收"
};

const stageExplanations: Record<CalendarContext["solarTermStage"], string> = {
  start: "气机正往上提",
  middle: "节律渐稳",
  end: "更适合把外放的力收一点"
};

const actionTagRules: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /散步|慢走/u, tag: "轻动舒展" },
  { pattern: /起身|舒展|拉伸/u, tag: "久坐打断" },
  { pattern: /睡前|入睡|安静|调暗|收尾/u, tag: "早点收尾" },
  { pattern: /晚餐|七分饱|油腻|热食|早餐|三餐/u, tag: "饮食守时" },
  { pattern: /补水/u, tag: "分次补水" },
  { pattern: /呼吸/u, tag: "缓息定神" },
  { pattern: /减少输入|无输入/u, tag: "减少刺激" },
  { pattern: /恢复课|热身|收操|训练/u, tag: "训练留余" }
];

const avoidTagRules: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /熬夜|深夜/u, tag: "熬夜硬撑" },
  { pattern: /过饱|暴食|夜宵|甜食|重口/u, tag: "夜里过饱" },
  { pattern: /刷屏|消息/u, tag: "刷屏过久" },
  { pattern: /争执|争论/u, tag: "火上加火" },
  { pattern: /高强度|夜训|超量/u, tag: "夜里硬练" },
  { pattern: /酒|辛辣|刺激/u, tag: "刺激过量" },
  { pattern: /浓茶|咖啡因/u, tag: "浓茶硬撑" },
  { pattern: /久坐|不站起来/u, tag: "久坐不动" },
  { pattern: /空腹/u, tag: "空腹硬撑" }
];

const hexagramCueRules: Array<{ pattern: RegExp; saying: string; explanation: string }> = [
  { pattern: /地雷|雷地/u, saying: "动中留稳", explanation: "动意已起，但脚步仍要落稳" },
  { pattern: /山水|水山/u, saying: "先收再行", explanation: "先做减法，比急着外放更合适" },
  { pattern: /雷/u, saying: "起而不躁", explanation: "有起势，也容易把动作推快" },
  { pattern: /水/u, saying: "先收心气", explanation: "更适合把心神和体力往回收一点" },
  { pattern: /山/u, saying: "先做减法", explanation: "适合先收口，再安排外放" },
  { pattern: /风/u, saying: "缓缓理顺", explanation: "细一点、慢一点更容易见效" },
  { pattern: /火/u, saying: "留住余温", explanation: "有亮劲，但别把节奏推得太满" },
  { pattern: /泽/u, saying: "舒展留余", explanation: "可以放松，但不宜过度外放" },
  { pattern: /地/u, saying: "脚步放稳", explanation: "更适合把动作做实" },
  { pattern: /天/u, saying: "有进有留", explanation: "能做事，但别急着加码" }
];

function toKey(value: string): string {
  return value.replace(/\s+/gu, "").replace(/[，。！？；：、,.!?;:()（）\-]/gu, "");
}

function buildStableSeed(...parts: string[]): number {
  return parts.join("|").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pickEntryByCategory(
  entries: KnowledgeEntry[],
  categories: KnowledgeCategory[],
  usedEntryIds: Set<string>
): KnowledgeEntry | undefined {
  for (const category of categories) {
    const match = entries.find((entry) => entry.category === category && !usedEntryIds.has(entry.id));
    if (match) {
      return match;
    }
  }

  return entries.find((entry) => entry.category !== "seasonal" && !usedEntryIds.has(entry.id));
}

function pickUniqueText(values: string[] | undefined, usedKeys: Set<string>): string | undefined {
  if (!values) {
    return undefined;
  }

  for (const value of values) {
    const normalized = value.trim();
    const key = toKey(normalized);
    if (!normalized || !key || usedKeys.has(key)) {
      continue;
    }

    usedKeys.add(key);
    return normalized;
  }

  return undefined;
}

function getTargetCategories(profile: UserProfile): KnowledgeCategory[] {
  if (profile.todayMood === "anxious" || profile.todayMood === "angry") {
    return ["emotion", "sleep", "diet", "exercise"];
  }
  if (profile.todayMood === "sad") {
    return ["emotion", "exercise", "sleep", "diet"];
  }
  if (profile.todayMood === "tired") {
    return profile.healthTags.includes("sedentary")
      ? ["exercise", "sleep", "diet", "emotion"]
      : ["sleep", "exercise", "diet", "emotion"];
  }
  if (profile.healthTags.includes("irregular_diet")) {
    return ["diet", "sleep", "exercise", "emotion"];
  }
  if (profile.healthTags.includes("regular_exercise")) {
    return ["exercise", "diet", "sleep", "emotion"];
  }

  return ["diet", "exercise", "sleep", "emotion"];
}

function getRecoveryCategories(profile: UserProfile): KnowledgeCategory[] {
  if (profile.healthTags.includes("late_sleep")) {
    return ["sleep", "diet", "exercise", "emotion"];
  }
  if (profile.healthTags.includes("irregular_diet")) {
    return ["diet", "sleep", "exercise", "emotion"];
  }
  if (profile.healthTags.includes("sedentary")) {
    return ["exercise", "sleep", "diet", "emotion"];
  }

  return ["sleep", "diet", "exercise", "emotion"];
}

function toActionTag(value: string): string | undefined {
  return actionTagRules.find((rule) => rule.pattern.test(value))?.tag;
}

function toAvoidTag(value: string): string | undefined {
  return avoidTagRules.find((rule) => rule.pattern.test(value))?.tag;
}

function pickDistinctTags(
  candidates: Array<string | undefined>,
  fallbackTags: readonly string[]
): [string, string] {
  const next: string[] = [];

  for (const candidate of [...candidates, ...fallbackTags]) {
    if (!candidate || next.includes(candidate)) {
      continue;
    }

    next.push(candidate);
    if (next.length === 2) {
      break;
    }
  }

  return [next[0], next[1]];
}

function getHexagramCue(hexagramName: string): { saying: string; explanation: string } {
  return (
    hexagramCueRules.find((rule) => rule.pattern.test(hexagramName)) ?? {
      saying: "缓急分明",
      explanation: "更适合先理顺轻重缓急"
    }
  );
}

function buildMysticSaying(
  calendar: CalendarContext,
  hexagram: HexagramContext,
  mood: Mood
): string {
  const moodTone = moodFocus[mood].tail;
  const hexagramCue = getHexagramCue(hexagram.name).saying;
  const candidates = [
    `${calendar.solarTermName}${stageSayings[calendar.solarTermStage]}，${moodTone}`,
    `${hexagramCue}，${moodTone}`,
    `${calendar.solarTermName}里，${hexagramCue}`
  ];
  const seed = buildStableSeed(calendar.dateKey, hexagram.key, mood);
  return candidates[seed % candidates.length];
}

function buildMysticExplanation(
  calendar: CalendarContext,
  hexagram: HexagramContext,
  mood: Mood
): string {
  const hexagramCue = getHexagramCue(hexagram.name);
  const focus = moodFocus[mood].focus;
  const candidates = [
    `${calendar.solarTermName}时节${stageExplanations[calendar.solarTermStage]}，${hexagramCue.explanation}。你今天偏${moodLabels[mood]}，先把${focus}安顿好。`,
    `${calendar.solarTermName}到了，${hexagramCue.explanation}。你今天偏${moodLabels[mood]}，更适合先顾${focus}，再谈加码。`
  ];
  const seed = buildStableSeed(calendar.solarTermKey, hexagram.name, mood, "explanation");
  return candidates[seed % candidates.length];
}

export function buildFallbackResult(
  calendar: CalendarContext,
  hexagram: HexagramContext,
  entries: KnowledgeEntry[],
  userProfile: UserProfile
): TianjiData {
  const usedEntryIds = new Set<string>();
  const usedActionKeys = new Set<string>();
  const usedAvoidKeys = new Set<string>();
  const seasonalEntry = entries.find((entry) => entry.category === "seasonal") ?? entries[0];
  if (seasonalEntry) {
    usedEntryIds.add(seasonalEntry.id);
  }

  const targetedEntry = pickEntryByCategory(entries, getTargetCategories(userProfile), usedEntryIds);
  if (targetedEntry) {
    usedEntryIds.add(targetedEntry.id);
  }

  const recoveryEntry = pickEntryByCategory(entries, getRecoveryCategories(userProfile), usedEntryIds);
  if (recoveryEntry) {
    usedEntryIds.add(recoveryEntry.id);
  }

  const selectedActions = [
    pickUniqueText(seasonalEntry?.actionItems, usedActionKeys),
    pickUniqueText(targetedEntry?.actionItems, usedActionKeys),
    pickUniqueText(recoveryEntry?.actionItems, usedActionKeys)
  ].filter(Boolean) as string[];

  const healthAdvice = [...selectedActions];
  for (const fallback of fallbackAdviceDefaults[userProfile.todayMood]) {
    if (healthAdvice.length >= 3) {
      break;
    }

    const key = toKey(fallback);
    if (!usedActionKeys.has(key)) {
      usedActionKeys.add(key);
      healthAdvice.push(fallback);
    }
  }

  const selectedAvoids = [
    pickUniqueText(seasonalEntry?.avoidItems, usedAvoidKeys),
    pickUniqueText(targetedEntry?.avoidItems, usedAvoidKeys),
    pickUniqueText(recoveryEntry?.avoidItems, usedAvoidKeys)
  ].filter(Boolean) as string[];

  const dos = pickDistinctTags(
    selectedActions.map((item) => toActionTag(item)),
    moodDos[userProfile.todayMood]
  );
  const donts = pickDistinctTags(
    selectedAvoids.map((item) => toAvoidTag(item)),
    moodDonts[userProfile.todayMood]
  );

  const normalized =
    normalizeGeneratedData({
      mysticSaying: buildMysticSaying(calendar, hexagram, userProfile.todayMood),
      mysticExplanation: buildMysticExplanation(calendar, hexagram, userProfile.todayMood),
      healthAdvice: [healthAdvice[0], healthAdvice[1], healthAdvice[2]],
      dos,
      donts
    }) ??
    normalizeGeneratedData({
      mysticSaying: `${calendar.solarTermName}${stageSayings[calendar.solarTermStage]}，${moodFocus[userProfile.todayMood].tail}`,
      mysticExplanation: `${calendar.solarTermName}时节宜轻展缓行。你今天偏${moodLabels[userProfile.todayMood]}，先把${moodFocus[userProfile.todayMood].focus}安顿好。`,
      healthAdvice: fallbackAdviceDefaults[userProfile.todayMood],
      dos: moodDos[userProfile.todayMood],
      donts: moodDonts[userProfile.todayMood]
    });

  if (!normalized) {
    throw new Error("Fallback content did not satisfy Tianji output constraints.");
  }

  return {
    ...normalized,
    meta: {
      solarTermName: calendar.solarTermName,
      ganZhiSummary: calendar.ganZhiSummary,
      hexagramName: hexagram.name,
      knowledgeIds: entries.map((entry) => entry.id),
      generatedAt: new Date().toISOString(),
      provider: "fallback",
      isFallback: true,
      requestId: "",
      fallbackReasonCode: "provider_unavailable"
    }
  };
}
