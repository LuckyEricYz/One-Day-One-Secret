import type { RolePreset } from "../types.js";

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "male",
    genderLabel: "男角色",
    label: "乾行先生",
    seal: "乾",
    roleSeed: 11,
    intro: "工作节奏偏快，久坐与应酬都不少，适合用稳作息和轻伸展把身体拉回正轨。",
    baseStatus: ["久坐后肩颈紧", "忙时吃饭偏快", "晚上容易继续硬撑"],
    baziSummary: "木火偏旺，今年更宜疏肝理气、稳睡眠，先收节奏再提效率。",
    annualFocus: ["先伸展后发力", "晚间少酒少辣", "任务之间留缓冲"],
    annualAvoids: ["连续熬夜顶状态", "空腹咖啡代替早餐"],
    emotionTraits: ["起势快，容易硬扛", "压力上来时更适合先动一动再静下来"],
    contentTags: ["desk_relief", "mobility", "sleep_regulation", "digestive_balance"]
  },
  {
    id: "female",
    genderLabel: "女角色",
    label: "和宁女士",
    seal: "和",
    roleSeed: 37,
    intro: "对气温和情绪都更敏感，换季时更需要顾脾胃、顾睡眠，也要给自己留暖和的余地。",
    baseStatus: ["久坐后下肢容易沉", "情绪忙时胃口会乱", "换季时更需要保暖"],
    baziSummary: "土水偏虚，今年更宜稳脾胃、顾气血、少寒凉，把恢复力放在第一位。",
    annualFocus: ["饮食偏温热", "活动以轻缓为主", "夜间尽量早点收尾"],
    annualAvoids: ["空腹冷饮", "情绪上头时继续硬扛"],
    emotionTraits: ["感受细，忙时容易忘了照顾自己", "更适合用稳定和暖意来调节节奏"],
    contentTags: ["warmth", "calm", "digestive_balance", "desk_relief"]
  }
];

export const ROLE_PRESET_MAP = Object.fromEntries(
  ROLE_PRESETS.map((role) => [role.id, role])
) as Record<RolePreset["id"], RolePreset>;
