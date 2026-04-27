import type { RolePreset } from "../types.js";

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "role_a",
    genderLabel: "职场男生",
    shortLabel: "男生",
    label: "职场男生",
    seal: "元",
    avatarVideoSrc: "/roles/role_a.webm",
    avatarPosterSrc: "/roles/role_a-poster.webp",
    avatarAlt: "穿衬衫打领带的职场男生卡通头像",
    roleSeed: 11,
    intro: "日程排得满，会议和久坐都不少，适合用短动作、稳三餐和早点收尾把状态拉回可控。",
    baseStatus: ["肩颈容易紧", "午后脑子发沉", "忙起来常忘记喝水"],
    baziSummary: "元亨利贞，今年更宜先稳节律再求推进，把体力留给真正重要的事。",
    annualFocus: ["任务先分段", "午后起身活动", "晚间早点收尾"],
    annualAvoids: ["连续久坐不动", "用咖啡硬顶疲劳"],
    emotionTraits: ["启动快，容易把疲惫藏起来", "压力上来时先动一动更容易恢复判断"],
    contentTags: ["desk_relief", "mobility", "sleep_regulation", "digestive_balance"]
  },
  {
    id: "role_b",
    genderLabel: "职场女生",
    shortLabel: "女生",
    label: "职场女生",
    seal: "和",
    avatarVideoSrc: "/roles/role_b.webm",
    avatarPosterSrc: "/roles/role_b-poster.webp",
    avatarAlt: "穿粉色裙装的职场女生卡通头像",
    roleSeed: 37,
    intro: "工作切换频繁，也会被气温、情绪和作息影响，适合用温和饮食与轻缓活动给自己续航。",
    baseStatus: ["下肢久坐易沉", "忙时胃口容易乱", "换季更想要暖一点"],
    baziSummary: "蒸蒸日上，今年更宜顾脾胃、稳睡眠、少寒凉，把恢复力放在第一位。",
    annualFocus: ["三餐偏温热", "留出情绪缓冲", "睡前减少输入"],
    annualAvoids: ["空腹冷饮", "情绪紧绷时继续硬扛"],
    emotionTraits: ["感受细，容易提前察觉身体变化", "节奏稳定时更能把事情处理得漂亮"],
    contentTags: ["warmth", "calm", "digestive_balance", "desk_relief"]
  }
];

export const ROLE_PRESET_MAP = Object.fromEntries(
  ROLE_PRESETS.map((role) => [role.id, role])
) as Record<RolePreset["id"], RolePreset>;
