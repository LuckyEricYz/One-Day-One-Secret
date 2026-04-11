import type { CalendarContext, HexagramContext, KnowledgeEntry, UserProfile } from "../types";
import { constitutionLabels, healthTagLabels, moodDescriptions, moodLabels } from "../shared/labels";

export function buildSystemPrompt(): string {
  return [
    "你是“天机观察者”，负责根据节气、卦象和用户当日状态，生成一张生活方式建议卡。",
    "输出必须是合法 JSON，不要附带解释文字。",
    "内容是生活建议，不是医疗建议。",
    "语气温和、克制，避免命令式表达。",
    "建议必须具体、低风险、可执行。",
    "不要出现疾病名称、药品名称、品牌名称。",
    "不要夸大卦象，不要把结果写成命运判断。"
  ].join("\n");
}

export function buildUserPrompt(
  calendar: CalendarContext,
  hexagram: HexagramContext,
  userProfile: UserProfile,
  entries: KnowledgeEntry[]
): string {
  const profileTags =
    userProfile.healthTags.length > 0
      ? userProfile.healthTags.map((tag) => healthTagLabels[tag]).join("、")
      : "无";

  const knowledgeLines = entries
    .map(
      (entry) =>
        `- [${entry.id}] ${entry.summary}；建议：${entry.actionItems.join("；")}；避免：${entry.avoidItems.join("；") || "无"}`
    )
    .join("\n");

  return `
请根据以下结构化信息生成今日天机卡。

【日历上下文】
- 节气：${calendar.solarTermName}
- 节气阶段：${calendar.solarTermStage}
- 干支：${calendar.ganZhiSummary}

【卦象】
- 卦名：${hexagram.name}
- 卦义摘要：${hexagram.summary}

【用户画像】
- 体质类型：${constitutionLabels[userProfile.constitution]}
- 生活标签：${profileTags}
- 今日状态：${moodLabels[userProfile.todayMood]}（${moodDescriptions[userProfile.todayMood]}）

【知识条目】
${knowledgeLines}

请严格输出 JSON：
{
  "mysticSaying": "不超过 20 字",
  "mysticExplanation": "1-2 句解释",
  "healthAdvice": ["建议1", "建议2", "建议3"],
  "dos": ["宜1", "宜2"],
  "donts": ["忌1", "忌2"]
}
`.trim();
}

