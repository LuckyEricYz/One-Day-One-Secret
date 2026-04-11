import type { CalendarContext, HexagramContext, KnowledgeEntry, Mood, TianjiData } from "../types";
import { moodLabels } from "../shared/labels";

const moodDos: Record<Mood, [string, string]> = {
  happy: ["保留节奏", "轻量活动"],
  calm: ["按时吃饭", "稳定作息"],
  tired: ["提早休息", "午后慢走"],
  anxious: ["减少输入", "放慢呼吸"],
  sad: ["热食正餐", "出门走动"],
  angry: ["先离开争执", "降低刺激"]
};

const moodDonts: Record<Mood, [string, string]> = {
  happy: ["兴奋过头", "临时熬夜"],
  calm: ["无节制加班", "暴食"],
  tired: ["硬撑深夜", "高强度夜训"],
  anxious: ["继续刷屏", "情绪性进食"],
  sad: ["整天不吃饭", "把自己关到深夜"],
  angry: ["带火争论", "借酒压情绪"]
};

export function buildFallbackResult(
  calendar: CalendarContext,
  hexagram: HexagramContext,
  entries: KnowledgeEntry[],
  mood: Mood
): TianjiData {
  const actionItems = Array.from(
    new Set(entries.flatMap((entry) => entry.actionItems))
  ).slice(0, 3);
  const avoidItems = Array.from(
    new Set(entries.flatMap((entry) => entry.avoidItems))
  ).slice(0, 2);

  return {
    mysticSaying: `${calendar.solarTermName}已至，宜稳住身心`.slice(0, 20),
    mysticExplanation: `今天的节气和卦象都更适合先收回多余消耗。状态偏${moodLabels[mood]}时，先把节奏守住，比继续加力更重要。`,
    healthAdvice: [
      actionItems[0] ?? "把晚间节奏放慢，尽量提早休息",
      actionItems[1] ?? "给自己留出 15 分钟轻走或拉伸时间",
      actionItems[2] ?? "晚餐控制在七分饱，减少高刺激饮食"
    ],
    dos: moodDos[mood],
    donts: [
      avoidItems[0] ?? moodDonts[mood][0],
      avoidItems[1] ?? moodDonts[mood][1]
    ],
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
