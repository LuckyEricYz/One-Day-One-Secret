import { getCalendarContext } from "./calendar.js";
import { EXERCISE_LIBRARY, ACUPOINT_LIBRARY, RECIPE_LIBRARY } from "./daily-content.js";
import { HEXAGRAM_LIBRARY } from "./hexagrams.js";
import { SOLAR_TERMS } from "./solarTerms.js";
import { getShanghaiNowIso } from "./time.js";
import type {
  AcupointItem,
  BirthHourBranch,
  DailyHexagram,
  DailySnapshot,
  ExerciseItem,
  Gender,
  RecipeItem,
  RolePreferenceTag,
  StoredUserProfileV3
} from "../types.js";

const SOLAR_TERM_MAP = Object.fromEntries(SOLAR_TERMS.map((term) => [term.key, term]));
const GENDER_LABELS: Record<Gender, string> = {
  male: "男",
  female: "女"
};

const BIRTH_HOUR_LABELS: Record<BirthHourBranch, string> = {
  zi: "子时",
  chou: "丑时",
  yin: "寅时",
  mao: "卯时",
  chen: "辰时",
  si: "巳时",
  wu: "午时",
  wei: "未时",
  shen: "申时",
  you: "酉时",
  xu: "戌时",
  hai: "亥时"
};

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function cleanProfileText(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function buildProfileHash(profile: StoredUserProfileV3): string {
  const normalized = [
    profile.gender,
    profile.birthDate,
    profile.birthHourBranch ?? "unknown",
    cleanProfileText(profile.birthPlace),
    cleanProfileText(profile.currentPlace)
  ].join("|");

  return hashString(normalized).toString(36);
}

function getBirthMonth(profile: StoredUserProfileV3): number {
  const month = Number(profile.birthDate.slice(5, 7));
  return Number.isFinite(month) ? month : 1;
}

function getBirthDay(profile: StoredUserProfileV3): number {
  const day = Number(profile.birthDate.slice(8, 10));
  return Number.isFinite(day) ? day : 1;
}

function deriveProfileTags(profile: StoredUserProfileV3): RolePreferenceTag[] {
  const tags = new Set<RolePreferenceTag>();
  const month = getBirthMonth(profile);
  const currentPlace = cleanProfileText(profile.currentPlace);

  if (profile.gender === "male") {
    tags.add("mobility");
    tags.add("desk_relief");
    tags.add("sleep_regulation");
  } else {
    tags.add("warmth");
    tags.add("calm");
    tags.add("digestive_balance");
  }

  if ([3, 4, 5].includes(month)) {
    tags.add("mobility");
    tags.add("calm");
  } else if ([6, 7, 8].includes(month)) {
    tags.add("digestive_balance");
    tags.add("calm");
  } else if ([9, 10, 11].includes(month)) {
    tags.add("desk_relief");
    tags.add("sleep_regulation");
  } else {
    tags.add("warmth");
    tags.add("digestive_balance");
  }

  if (profile.birthHourBranch && ["zi", "hai", "chou"].includes(profile.birthHourBranch)) {
    tags.add("sleep_regulation");
    tags.add("warmth");
  } else if (profile.birthHourBranch && ["yin", "mao", "chen", "si"].includes(profile.birthHourBranch)) {
    tags.add("mobility");
    tags.add("desk_relief");
  } else if (profile.birthHourBranch && ["wu", "wei", "shen"].includes(profile.birthHourBranch)) {
    tags.add("digestive_balance");
  } else if (profile.birthHourBranch) {
    tags.add("calm");
    tags.add("sleep_regulation");
  }

  if (/[广深杭沪苏厦福海三亚]/u.test(currentPlace)) {
    tags.add("digestive_balance");
    tags.add("calm");
  }

  if (/[北哈沈长呼乌兰西宁]/u.test(currentPlace)) {
    tags.add("warmth");
    tags.add("desk_relief");
  }

  return [...tags];
}

function buildProfileDigest(profile: StoredUserProfileV3): string {
  const birthPlace = profile.birthPlace.trim();
  const currentPlace = profile.currentPlace.trim();
  const hourText = profile.birthHourBranch ? `${BIRTH_HOUR_LABELS[profile.birthHourBranch]}出生` : "出生时辰未填";

  return `${GENDER_LABELS[profile.gender]} · ${birthPlace}生 · 现居${currentPlace} · ${hourText}`;
}

function buildBirthTimeSummary(profile: StoredUserProfileV3): string {
  if (!profile.birthHourBranch) {
    return "未填写出生时辰，本页按出生日期、性别与所在地生成，只作为今日节律参考。";
  }

  return `${BIRTH_HOUR_LABELS[profile.birthHourBranch]}入盘，今日建议看重节奏先后，不把单一标签当定论。`;
}

function buildLocationSummary(profile: StoredUserProfileV3, solarTermName: string): string {
  return `当前所在地「${profile.currentPlace.trim()}」参与今日节律参照，结合${solarTermName}给出宜忌与轻养生建议。`;
}

function countMatches(source: RolePreferenceTag[], target: RolePreferenceTag[]): number {
  return target.filter((item) => source.includes(item)).length;
}

function sortByRelevance<T extends { id: string; tags: RolePreferenceTag[] }>(
  items: T[],
  seed: string,
  roleTags: RolePreferenceTag[],
  seasonBoost: (item: T) => number
): T[] {
  return [...items].sort((left, right) => {
    const leftScore =
      countMatches(roleTags, left.tags) * 10 +
      seasonBoost(left) * 4 +
      (hashString(`${seed}:${left.id}`) % 1000) / 1000;
    const rightScore =
      countMatches(roleTags, right.tags) * 10 +
      seasonBoost(right) * 4 +
      (hashString(`${seed}:${right.id}`) % 1000) / 1000;

    return rightScore - leftScore;
  });
}

function buildAdviceLine(tag: string): string {
  const mapping: Record<string, string> = {
    定主次: "先把最重要的 1 件事做完，再考虑加码。",
    稳步推进: "节奏宜稳，不用把今天排得满满当当。",
    放松肩面: "肩颈和下颌都记得松一下，别一直提着气。",
    把呼吸拉长: "任务切换前先做两次长呼气，让身体跟上脑子。",
    控火气: "饮食和情绪都往清一点收，别越忙越燥。",
    减少晚间刺激: "晚饭后把输入降一档，给睡前留安静区。",
    先活动身体: "先站起来动一小段，再去处理卡住的事。",
    分段完成任务: "把任务拆小块，身体和脑子都更不容易顶住。",
    通气机: "少憋着，走动和拉伸会比继续坐着更有效。",
    把节奏理顺: "今天先理顺顺序，再追求效率。",
    补水: "分次喝温水，比口渴后猛灌更合适。",
    守住休息段: "午后留出 5 分钟静息，能把后半天拉回来。",
    做减法: "把不必要的应酬和额外输出降一点。",
    早点收尾: "晚上收工时间尽量往前提，别把疲劳拖进夜里。",
    顾脾胃: "三餐别空着，熟软温热会比刺激重口更舒服。",
    把日常落稳: "今天比起求新鲜，更适合守住规律。"
  };

  return mapping[tag] ?? "今天更适合把节奏放稳一点。";
}

function buildCautionLine(tag: string): string {
  const mapping: Record<string, string> = {
    过满: "别把每个空档都塞满，留一点余地更稳。",
    一口气顶到底: "感觉累了就切段，不必硬顶到完全透支。",
    外放过头: "社交和外卖都别叠得太满，容易越放越散。",
    社交过量: "今晚能少一场应酬，就给身体少一点负担。",
    辛辣叠加: "今天别用辛辣和酒精一起提神。",
    情绪上头: "情绪冲上来时先离开火点，别急着正面硬碰。",
    急冲: "一着急就更容易乱，先让动作慢半拍。",
    硬撑不歇: "疲劳已经出现时，继续加码只会回收更慢。",
    拖着不动: "坐太久会越坐越堵，记得起身换气。",
    反复消耗: "别在同一件事上反复打转，先换一个轻一点的动作。",
    寒凉过量: "冷饮和空调叠加时，身体更容易发虚。",
    熬夜透支: "今天不适合拿熬夜去补白天的进度。",
    久坐不动: "卡住的时候先走两步，不要继续坐着扛。",
    节奏过满: "别把休息全压缩掉，晚上更要给自己收口。",
    饮食失序: "过饿过饱都不合适，规律一点更重要。",
    过度操心: "把注意力收回自己，不必样样都接。"
  };

  return mapping[tag] ?? "今天少一点额外消耗会更舒服。";
}

function prefixWithFirst(value: string): string {
  return value.startsWith("先") ? value : `先${value}`;
}

function buildHexagramCopy(
  profile: StoredUserProfileV3,
  profileDigest: string,
  solarTermName: string,
  seasonalSummary: string,
  hexagram: DailyHexagram
): DailyHexagram {
  const focusLead = hexagram.focusTags[0] ?? "稳节奏";
  const focusTail = hexagram.focusTags[1] ?? "少透支";
  const advice = hexagram.focusTags.slice(0, 2).map(buildAdviceLine);
  const cautions = hexagram.avoidTags.slice(0, 2).map(buildCautionLine);

  return {
    ...hexagram,
    headline: `${hexagram.name}当值，${hexagram.image}，今天宜${focusLead}、${focusTail}。`,
    guidance: `上卦${hexagram.upperTrigram}、下卦${hexagram.lowerTrigram}，取「${hexagram.theme}」之意。${solarTermName}时节${seasonalSummary}，结合你填写的${profileDigest}，今天更适合${prefixWithFirst(focusLead)}，再慢慢把事情推开。`,
    advice,
    cautions
  };
}

function pickExercises(
  profileHash: string,
  dateKey: string,
  season: string,
  profileTags: RolePreferenceTag[]
): ExerciseItem[] {
  const count = 1 + (hashString(`${dateKey}:${profileHash}:exercise-count`) % 2);
  const ranked = sortByRelevance(
    EXERCISE_LIBRARY,
    `${dateKey}:${profileHash}:exercise`,
    profileTags,
    (item) => (item.seasons.includes(season as never) ? 1 : 0)
  );

  return ranked.slice(0, count);
}

function pickAcupoint(
  profileHash: string,
  dateKey: string,
  season: string,
  profileTags: RolePreferenceTag[]
): AcupointItem {
  const ranked = sortByRelevance(
    ACUPOINT_LIBRARY,
    `${dateKey}:${profileHash}:acupoint`,
    profileTags,
    (item) => (item.seasons.includes(season as never) ? 1 : 0)
  );

  return ranked[0];
}

function pickRecipe(
  profileHash: string,
  dateKey: string,
  solarTermKey: string,
  profileTags: RolePreferenceTag[]
): RecipeItem {
  const candidates = RECIPE_LIBRARY.filter((item) => item.solarTermKeys.includes(solarTermKey));
  const ranked = sortByRelevance(candidates, `${dateKey}:${profileHash}:recipe`, profileTags, () => 1);

  return ranked[0];
}

function buildAlmanac(
  profile: StoredUserProfileV3,
  profileDigest: string,
  solarTermName: string,
  seasonalSummary: string,
  hexagram: DailyHexagram
): DailySnapshot["almanac"] {
  const primaryDo = hexagram.focusTags[0] ?? "稳住节奏";
  const secondaryDo = hexagram.focusTags[1] ?? "留出余地";
  const primaryDont = hexagram.avoidTags[0] ?? "节奏过满";
  const currentPlace = profile.currentPlace.trim();

  return {
    dos: [primaryDo, secondaryDo],
    donts: [primaryDont, hexagram.avoidTags[1] ?? "硬撑不歇"],
    statusTitle: `今日宜${primaryDo}`,
    statusSummary: `${currentPlace}今日按${solarTermName}与${hexagram.name}取象，适合把${secondaryDo}放在前面，少一点临时加码。`,
    hourNote: profile.birthHourBranch
      ? `${BIRTH_HOUR_LABELS[profile.birthHourBranch]}已纳入本地规则，结果更偏向今日节奏提醒。`
      : "未填写出生时辰，本页不做精确时柱判断，只按出生日期与所在地估算。",
    locationNote: `${profileDigest}；${solarTermName}时节${seasonalSummary}。`
  };
}

export function buildDailySnapshot(profile: StoredUserProfileV3, timestamp = Date.now()): DailySnapshot {
  const calendar = getCalendarContext(timestamp);
  const solarTerm = SOLAR_TERM_MAP[calendar.solarTermKey];
  const profileHash = buildProfileHash(profile);
  const profileTags = deriveProfileTags(profile);
  const profileDigest = buildProfileDigest(profile);
  const hexagramIndex =
    (hashString(`${calendar.dateKey}:${profileHash}`) + solarTerm.monthNumber * 3 + getBirthDay(profile)) %
    HEXAGRAM_LIBRARY.length;
  const rawHexagram = HEXAGRAM_LIBRARY[hexagramIndex];
  const seasonalSummary = solarTerm.summary.replace("。", "");
  const hexagram = buildHexagramCopy(
    profile,
    profileDigest,
    calendar.solarTermName,
    seasonalSummary,
    rawHexagram
  );

  return {
    id: `${profileHash}-${calendar.dateKey}`,
    profileHash,
    profileLabel: `${GENDER_LABELS[profile.gender]} · ${profile.currentPlace.trim()}`,
    dateKey: calendar.dateKey,
    generatedAt: getShanghaiNowIso(timestamp),
    calendar,
    seasonalSummary: `${solarTerm.summary} 今日小提醒：${solarTerm.actions[0]}。`,
    profileDigest,
    birthTimeSummary: buildBirthTimeSummary(profile),
    locationSummary: buildLocationSummary(profile, calendar.solarTermName),
    almanac: buildAlmanac(profile, profileDigest, calendar.solarTermName, seasonalSummary, hexagram),
    hexagram,
    exercises: pickExercises(profileHash, calendar.dateKey, solarTerm.season, profileTags),
    acupoint: pickAcupoint(profileHash, calendar.dateKey, solarTerm.season, profileTags),
    recipe: pickRecipe(profileHash, calendar.dateKey, calendar.solarTermKey, profileTags)
  };
}
