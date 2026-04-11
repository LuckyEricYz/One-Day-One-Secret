import type { KnowledgeEntry } from "../types.js";
import { SOLAR_TERMS } from "./solarTerms.js";

const seasonalEntries: KnowledgeEntry[] = SOLAR_TERMS.map((term, index) => ({
  id: `seasonal-${String(index + 1).padStart(3, "0")}`,
  sourceType: "classic",
  sourceTitle: "节气起居整理",
  sourceSection: term.name,
  category: "seasonal",
  summary: term.summary,
  actionItems: term.actions,
  avoidItems: term.avoids,
  tags: {
    solarTerms: [term.key],
    constitutions: [
      "balanced",
      "qi_deficiency",
      "yang_deficiency",
      "yin_deficiency",
      "qi_stagnation",
      "phlegm_dampness"
    ],
    moods: ["happy", "calm", "tired", "anxious", "sad", "angry"],
    healthTags: ["late_sleep", "sedentary", "irregular_diet", "regular_exercise"]
  },
  priority: 0.95
}));

const genericEntries: KnowledgeEntry[] = [
  {
    id: "sleep-001",
    sourceType: "guideline",
    sourceTitle: "健康生活方式指南",
    sourceSection: "睡眠节律",
    category: "sleep",
    summary: "疲惫状态下，最有效的恢复往往不是硬扛，而是给睡眠留出完整时间。",
    actionItems: ["睡前 1 小时停止高强度输入", "把入睡时间提前 30 分钟", "夜里减少零食和酒精"],
    avoidItems: ["熬夜补任务", "躺床后继续刷屏"],
    tags: {
      solarTerms: [],
      constitutions: ["balanced", "qi_deficiency", "yin_deficiency"],
      moods: ["tired", "sad", "anxious"],
      healthTags: ["late_sleep"]
    },
    priority: 0.9
  },
  {
    id: "sleep-002",
    sourceType: "guideline",
    sourceTitle: "健康生活方式指南",
    sourceSection: "睡眠稳定",
    category: "sleep",
    summary: "情绪起伏大时，先让环境安静下来，比继续思考更有帮助。",
    actionItems: ["睡前调暗屏幕和灯光", "让卧室保持安静和稍凉", "睡前用热水洗脸或泡脚"],
    avoidItems: ["临睡前争执", "带着工作上床"],
    tags: {
      solarTerms: [],
      constitutions: ["balanced", "qi_stagnation", "yang_deficiency"],
      moods: ["anxious", "angry", "sad"],
      healthTags: ["late_sleep"]
    },
    priority: 0.84
  },
  {
    id: "sleep-003",
    sourceType: "guideline",
    sourceTitle: "健康生活方式指南",
    sourceSection: "恢复优先级",
    category: "sleep",
    summary: "白天消耗大时，晚上应优先回收精力，而不是继续追求效率。",
    actionItems: ["把最晚工作截止时间前移", "夜间改为轻度拉伸或散步", "减少咖啡因的延迟摄入"],
    avoidItems: ["靠浓茶撑到深夜", "高强度夜训"],
    tags: {
      solarTerms: [],
      constitutions: ["qi_deficiency", "yang_deficiency", "phlegm_dampness"],
      moods: ["tired"],
      healthTags: ["late_sleep", "sedentary"]
    },
    priority: 0.82
  },
  {
    id: "sleep-004",
    sourceType: "guideline",
    sourceTitle: "健康生活方式指南",
    sourceSection: "睡前整理",
    category: "sleep",
    summary: "如果一天已经很满，睡前更需要做减法，让身体确认今天已经结束。",
    actionItems: ["列出明天三件最重要的事", "把手机放远一点", "让睡前 20 分钟保持安静"],
    avoidItems: ["睡前继续看消息", "临时开启新任务"],
    tags: {
      solarTerms: [],
      constitutions: ["balanced", "qi_stagnation", "qi_deficiency"],
      moods: ["anxious", "tired"],
      healthTags: ["late_sleep"]
    },
    priority: 0.8
  },
  {
    id: "diet-001",
    sourceType: "guideline",
    sourceTitle: "公共健康饮食建议",
    sourceSection: "规律进食",
    category: "diet",
    summary: "节奏不稳时，先把三餐拉回规律，往往比追求复杂养生更有效。",
    actionItems: ["早餐尽量在起床后 2 小时内完成", "晚餐控制在七分饱", "两餐之间优先补水"],
    avoidItems: ["长时间空腹后暴食", "深夜重口进食"],
    tags: {
      solarTerms: [],
      constitutions: ["balanced", "qi_deficiency", "phlegm_dampness"],
      moods: ["tired", "calm"],
      healthTags: ["irregular_diet"]
    },
    priority: 0.88
  },
  {
    id: "diet-002",
    sourceType: "guideline",
    sourceTitle: "公共健康饮食建议",
    sourceSection: "刺激控制",
    category: "diet",
    summary: "情绪上扬或烦躁时，减少酒精、辛辣和高糖，身体会更快回到平衡。",
    actionItems: ["把夜宵换成热食或不吃", "白天分次补水", "晚餐减少辛辣和酒精"],
    avoidItems: ["情绪性进食", "用甜食补偿压力"],
    tags: {
      solarTerms: [],
      constitutions: ["yin_deficiency", "qi_stagnation", "phlegm_dampness"],
      moods: ["angry", "anxious"],
      healthTags: ["irregular_diet"]
    },
    priority: 0.84
  },
  {
    id: "diet-003",
    sourceType: "guideline",
    sourceTitle: "公共健康饮食建议",
    sourceSection: "补水节律",
    category: "diet",
    summary: "补水最怕一次猛灌，少量多次更容易让身体真正用上。",
    actionItems: ["起床后先喝一杯温水", "每 1-2 小时补水一次", "运动后优先补水再进食"],
    avoidItems: ["口渴后一次喝太多", "用含糖饮料替代白水"],
    tags: {
      solarTerms: [],
      constitutions: ["balanced", "yin_deficiency", "qi_deficiency"],
      moods: ["happy", "tired", "anxious"],
      healthTags: []
    },
    priority: 0.8
  },
  {
    id: "diet-004",
    sourceType: "guideline",
    sourceTitle: "公共健康饮食建议",
    sourceSection: "脾胃负担",
    category: "diet",
    summary: "久坐和作息乱时，饮食越简单，身体越容易恢复日常节律。",
    actionItems: ["主食和热食保持稳定", "减少连续外卖和油炸", "下午嘴馋时优先水果或坚果"],
    avoidItems: ["冰冷甜腻叠加", "工作时无意识进食"],
    tags: {
      solarTerms: [],
      constitutions: ["phlegm_dampness", "qi_deficiency"],
      moods: ["calm", "tired"],
      healthTags: ["sedentary", "irregular_diet"]
    },
    priority: 0.82
  },
  {
    id: "exercise-001",
    sourceType: "guideline",
    sourceTitle: "公共健康活动建议",
    sourceSection: "久坐打断",
    category: "exercise",
    summary: "久坐时最重要的不是一次练很多，而是把不动的时间切短。",
    actionItems: ["每 60-90 分钟起身活动 3 分钟", "下午安排一次 15 分钟步行", "久坐后先舒展再继续工作"],
    avoidItems: ["一整天几乎不站起来", "疲惫时强行做高强度训练"],
    tags: {
      solarTerms: [],
      constitutions: ["balanced", "qi_stagnation", "phlegm_dampness"],
      moods: ["calm", "tired"],
      healthTags: ["sedentary"]
    },
    priority: 0.9
  },
  {
    id: "exercise-002",
    sourceType: "guideline",
    sourceTitle: "公共健康活动建议",
    sourceSection: "低负担活动",
    category: "exercise",
    summary: "身体发沉或疲惫时，轻量活动往往比完全不动更能恢复状态。",
    actionItems: ["散步 15-20 分钟", "做一组肩颈和髋部舒展", "把运动安排在白天或傍晚"],
    avoidItems: ["晚上硬顶高强度训练", "运动完立刻久坐"],
    tags: {
      solarTerms: [],
      constitutions: ["qi_deficiency", "phlegm_dampness", "yang_deficiency"],
      moods: ["tired", "sad"],
      healthTags: ["sedentary"]
    },
    priority: 0.84
  },
  {
    id: "exercise-003",
    sourceType: "guideline",
    sourceTitle: "公共健康活动建议",
    sourceSection: "规律训练",
    category: "exercise",
    summary: "已经有运动习惯时，真正需要的是顺着身体状态调节强度，而不是每天都拼。",
    actionItems: ["状态一般时把训练改成恢复课", "运动前后都给身体留缓冲", "热身和收操都不要省"],
    avoidItems: ["连续多天超量训练", "疲惫时继续加码"],
    tags: {
      solarTerms: [],
      constitutions: ["balanced", "yang_deficiency", "yin_deficiency"],
      moods: ["happy", "calm", "tired"],
      healthTags: ["regular_exercise"]
    },
    priority: 0.78
  },
  {
    id: "emotion-001",
    sourceType: "guideline",
    sourceTitle: "公共健康情绪建议",
    sourceSection: "焦虑缓冲",
    category: "emotion",
    summary: "焦虑上来时，先让身体慢一点，情绪才有空间往下落。",
    actionItems: ["把呼吸放慢到 4 秒吸 4 秒呼", "先做最小可执行的一步", "给自己留 10 分钟无输入时间"],
    avoidItems: ["边焦虑边叠加任务", "用刷屏麻痹自己"],
    tags: {
      solarTerms: [],
      constitutions: ["qi_stagnation", "qi_deficiency"],
      moods: ["anxious"],
      healthTags: ["late_sleep"]
    },
    priority: 0.92
  },
  {
    id: "emotion-002",
    sourceType: "guideline",
    sourceTitle: "公共健康情绪建议",
    sourceSection: "情绪收束",
    category: "emotion",
    summary: "烦躁时最先要做的不是压住情绪，而是撤掉继续点火的环境。",
    actionItems: ["先离开让你更上头的场景", "把争论延后到状态平稳后", "用走动代替硬憋"],
    avoidItems: ["带着火气继续对话", "烦躁时饮酒"],
    tags: {
      solarTerms: [],
      constitutions: ["qi_stagnation", "yin_deficiency"],
      moods: ["angry"],
      healthTags: []
    },
    priority: 0.88
  },
  {
    id: "emotion-003",
    sourceType: "guideline",
    sourceTitle: "公共健康情绪建议",
    sourceSection: "低落照料",
    category: "emotion",
    summary: "低落时先把当天难度降下来，允许自己先回到基本节律。",
    actionItems: ["只保留当天最重要的三件事", "吃一顿正常热饭", "给自己一个安静的散步时间"],
    avoidItems: ["整天不吃正餐", "把自己隔离到深夜"],
    tags: {
      solarTerms: [],
      constitutions: ["qi_deficiency", "yang_deficiency"],
      moods: ["sad"],
      healthTags: ["late_sleep", "irregular_diet"]
    },
    priority: 0.86
  },
  {
    id: "emotion-004",
    sourceType: "guideline",
    sourceTitle: "公共健康情绪建议",
    sourceSection: "平稳维护",
    category: "emotion",
    summary: "状态平稳时，不必继续追求刺激，把节奏守住就是很好的积累。",
    actionItems: ["按时吃饭和休息", "把时间留给一件真正想做的事", "白天安排一点轻活动"],
    avoidItems: ["为了效率打乱作息", "连续无休止地输入信息"],
    tags: {
      solarTerms: [],
      constitutions: ["balanced"],
      moods: ["happy", "calm"],
      healthTags: []
    },
    priority: 0.74
  }
];

export const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [...seasonalEntries, ...genericEntries];

