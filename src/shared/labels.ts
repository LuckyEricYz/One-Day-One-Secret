import type { Constitution, HealthTag, Mood } from "../types.js";

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

