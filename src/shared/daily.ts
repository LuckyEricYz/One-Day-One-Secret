import { getCalendarContext } from "./calendar.js";
import { EXERCISE_LIBRARY, ACUPOINT_LIBRARY, RECIPE_LIBRARY } from "./daily-content.js";
import { HEXAGRAM_LIBRARY } from "./hexagrams.js";
import { ROLE_PRESET_MAP } from "./roles.js";
import { SOLAR_TERMS } from "./solarTerms.js";
import { getShanghaiNowIso } from "./time.js";
import type {
  AcupointItem,
  DailyHexagram,
  DailySnapshot,
  ExerciseItem,
  RecipeItem,
  RoleId,
  RolePreferenceTag
} from "../types.js";

const SOLAR_TERM_MAP = Object.fromEntries(SOLAR_TERMS.map((term) => [term.key, term]));

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
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

function buildHexagramCopy(
  roleLabel: string,
  roleDigest: string,
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
    headline: `${hexagram.name}当值，今天宜${focusLead}，也要${focusTail}。`,
    guidance: `${solarTermName}时节${seasonalSummary}。结合${roleLabel}平时的${roleDigest}，更适合先${focusLead}，再慢慢把事情推开。`,
    advice,
    cautions
  };
}

function pickExercises(
  roleId: RoleId,
  dateKey: string,
  season: string,
  roleTags: RolePreferenceTag[]
): ExerciseItem[] {
  const count = 1 + (hashString(`${dateKey}:${roleId}:exercise-count`) % 2);
  const ranked = sortByRelevance(
    EXERCISE_LIBRARY,
    `${dateKey}:${roleId}:exercise`,
    roleTags,
    (item) => (item.seasons.includes(season as never) ? 1 : 0)
  );

  return ranked.slice(0, count);
}

function pickAcupoint(
  roleId: RoleId,
  dateKey: string,
  season: string,
  roleTags: RolePreferenceTag[]
): AcupointItem {
  const ranked = sortByRelevance(
    ACUPOINT_LIBRARY,
    `${dateKey}:${roleId}:acupoint`,
    roleTags,
    (item) => (item.seasons.includes(season as never) ? 1 : 0)
  );

  return ranked[0];
}

function pickRecipe(
  roleId: RoleId,
  dateKey: string,
  solarTermKey: string,
  roleTags: RolePreferenceTag[]
): RecipeItem {
  const candidates = RECIPE_LIBRARY.filter((item) => item.solarTermKeys.includes(solarTermKey));
  const ranked = sortByRelevance(candidates, `${dateKey}:${roleId}:recipe`, roleTags, () => 1);

  return ranked[0];
}

export function buildDailySnapshot(roleId: RoleId, timestamp = Date.now()): DailySnapshot {
  const role = ROLE_PRESET_MAP[roleId];
  const calendar = getCalendarContext(timestamp);
  const solarTerm = SOLAR_TERM_MAP[calendar.solarTermKey];
  const hexagramIndex =
    (hashString(calendar.dateKey) + role.roleSeed + solarTerm.monthNumber * 3) %
    HEXAGRAM_LIBRARY.length;
  const rawHexagram = HEXAGRAM_LIBRARY[hexagramIndex];
  const roleDigest = role.baseStatus.slice(0, 2).join("、");
  const seasonalSummary = solarTerm.summary.replace("。", "");
  const hexagram = buildHexagramCopy(
    role.label,
    roleDigest,
    calendar.solarTermName,
    seasonalSummary,
    rawHexagram
  );

  return {
    id: `${roleId}-${calendar.dateKey}`,
    roleId,
    dateKey: calendar.dateKey,
    generatedAt: getShanghaiNowIso(timestamp),
    calendar,
    seasonalSummary: `${solarTerm.summary} 今日小提醒：${solarTerm.actions[0]}。`,
    roleDigest,
    hexagram,
    exercises: pickExercises(roleId, calendar.dateKey, solarTerm.season, role.contentTags),
    acupoint: pickAcupoint(roleId, calendar.dateKey, solarTerm.season, role.contentTags),
    recipe: pickRecipe(roleId, calendar.dateKey, calendar.solarTermKey, role.contentTags)
  };
}
