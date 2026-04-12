import type { CalendarContext, HexagramContext, UserProfile } from "../types.js";
import { constitutionLabels, healthTagLabels, moodDescriptions, moodLabels } from "../shared/labels.js";
import type { KnowledgeSelection } from "./knowledge.js";
import type { GenerationQualityReport } from "./quality.js";

export function buildSystemPrompt(): string {
  return [
    "你是“天机观察者”，负责根据节气、卦象和用户当日状态，生成一张生活方式建议卡。",
    "输出必须是合法 JSON，不要附带解释文字。",
    "内容是生活建议，不是医疗建议。",
    "语气要温和、克制，带一点诗性，但主体仍是现代、可执行的建议。",
    "建议必须具体、低风险、可执行。",
    "不要出现疾病名称、药品名称、品牌名称。",
    "不要夸大卦象，不要把结果写成命运判断。",
    "不要让字段之间互相复述，同一个动作不要同时写进建议和宜忌。",
    "优先改写给定动作，不要重新发明抽象口号。",
    "避免套用这些高频模板：'X已至，宜稳住身心'、'先稳其X，再起其Y'、'今天更适合...'、'你今天偏X，先把Y安顿好'、'更适合先顾X，再谈加码'。",
    "三条 advice 尽量换起句，不要都用“先”“把”“让”“今晚”开头。"
  ].join("\n");
}

function formatKnowledgeEntry(prefix: string, lineType: string, selectionLine: {
  id: string;
  sourceSection: string;
  summary: string;
  actionItems: string[];
  avoidItems: string[];
}): string {
  return [
    `- ${prefix} [${selectionLine.id}] ${selectionLine.sourceSection}`,
    `  ${lineType}：${selectionLine.summary}`,
    `  优先动作：${selectionLine.actionItems.join("；")}`,
    `  避免事项：${selectionLine.avoidItems.join("；") || "无"}`
  ].join("\n");
}

export function buildUserPrompt(
  calendar: CalendarContext,
  hexagram: HexagramContext,
  userProfile: UserProfile,
  selection: KnowledgeSelection
): string {
  const profileTags =
    userProfile.healthTags.length > 0
      ? userProfile.healthTags.map((tag) => healthTagLabels[tag]).join("、")
      : "无";

  const requiredKnowledgeLines = [
    selection.seasonal
      ? formatKnowledgeEntry("节气动作", "节气提示", selection.seasonal)
      : null,
    selection.targeted
      ? formatKnowledgeEntry("人物动作", "人物重点", selection.targeted)
      : null,
    selection.recovery
      ? formatKnowledgeEntry("恢复动作", "恢复补位", selection.recovery)
      : null
  ]
    .filter(Boolean)
    .join("\n");
  const supplementalKnowledgeLines =
    selection.supplemental.length > 0
      ? selection.supplemental
          .map((entry) => formatKnowledgeEntry("补充参考", "补充信息", entry))
          .join("\n")
      : "- 无额外补充";

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

【必须落地的动作来源】
${requiredKnowledgeLines}

【补充参考】
${supplementalKnowledgeLines}

请严格按照下面的字段职责输出 JSON：
- mysticSaying：8-16 个汉字，单行短句，像卡片标题，不要写成完整解释句，不要带书名号或引号。
- mysticExplanation：28-52 个汉字，1-2 句，必须同时交代节气/卦象提示和今天的行动重点。
- healthAdvice：正好 3 条，每条 10-24 个汉字，必须是普通人今天就能做的具体动作。
- 第 1 条 advice 优先承接节气动作；第 2 条优先承接今日状态或生活标签；第 3 条优先补恢复性动作。
- 3 条 advice 里至少 2 条必须能明显看出改写自上面的具体动作，其中 1 条来自节气动作，1 条来自人物动作或恢复动作。
- dos 和 donts：各 2 条，每条 2-10 个汉字，只能写标签式短语，不能写成长句，不能直接复述 advice。
- mysticExplanation 不要写成“你今天偏X，先把Y安顿好”“更适合先顾X，再谈加码”这类模板句。
- 优先使用知识条目里的动作语义，避免空泛总结和重复句式。
- advice 三条尽量换起句，不要连续用同一种句法。

请严格输出 JSON：
{
  "mysticSaying": "8-16 个汉字",
  "mysticExplanation": "28-52 个汉字，1-2 句",
  "healthAdvice": ["10-24 个汉字的建议1", "10-24 个汉字的建议2", "10-24 个汉字的建议3"],
  "dos": ["2-10 个汉字的宜1", "2-10 个汉字的宜2"],
  "donts": ["2-10 个汉字的忌1", "2-10 个汉字的忌2"]
}
`.trim();
}

function stringifyModelOutput(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function buildRepairUserPrompt(
  basePrompt: string,
  previousOutput: unknown,
  report: GenerationQualityReport
): string {
  const issueLines =
    report.issues.length > 0
      ? report.issues.map((issue) => `- ${issue.message}`).join("\n")
      : "- 需要完整重写，减少模板感并增强知识落地。";

  return `
${basePrompt}

【上一次输出不合格】
${issueLines}

【上一次输出】
${stringifyModelOutput(previousOutput)}

请保留原始输入事实不变，完整重写整个 JSON，不要只局部替换几个词。
优先修正上面列出的问题，再满足结构要求。
`.trim();
}
