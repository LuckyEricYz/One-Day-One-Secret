import type {
  Constitution,
  DailySupplement,
  HeadSense,
  HealthTag,
  Mood,
  SleepDuration,
  TongueCoating
} from "../types.js";

export const constitutionLabels: Record<Constitution, string> = {
  balanced: "平和",
  qi_deficiency: "气虚",
  yang_deficiency: "阳虚",
  yin_deficiency: "阴虚",
  qi_stagnation: "气滞",
  phlegm_dampness: "痰湿"
};

export const healthTagLabels: Record<HealthTag, string> = {
  late_sleep: "经常熬夜",
  sedentary: "长期久坐",
  irregular_diet: "饮食不规律",
  regular_exercise: "规律运动"
};

export const moodLabels: Record<Mood, string> = {
  happy: "愉快",
  calm: "平静",
  tired: "疲惫",
  anxious: "焦虑",
  sad: "低落",
  angry: "烦躁"
};

export const moodDescriptions: Record<Mood, string> = {
  happy: "状态轻盈，适合稳定节奏",
  calm: "情绪平稳，适合按部就班",
  tired: "更需要休息和缓冲",
  anxious: "需要减少刺激和额外消耗",
  sad: "适合降低强度，先照顾自己",
  angry: "需要收束情绪，避免继续加压"
};

export const headSenseLabels: Record<HeadSense, string> = {
  clear: "轻松清明",
  slightly_full: "微微发胀",
  rising: "有些上冲"
};

export const sleepDurationLabels: Record<SleepDuration, string> = {
  short: "少于 5 小时",
  medium: "5-7 小时",
  long: "7 小时以上"
};

export const tongueCoatingLabels: Record<TongueCoating, string> = {
  thin_white: "薄白",
  thick_white: "偏白偏厚",
  slightly_yellow: "微黄"
};

export function formatSupplementSummary(supplement: DailySupplement): string[] {
  return [
    `头面体感 ${headSenseLabels[supplement.headSense]}`,
    `睡眠 ${sleepDurationLabels[supplement.sleepDuration]}`,
    `舌苔观感 ${tongueCoatingLabels[supplement.tongueCoating]}`
  ];
}
