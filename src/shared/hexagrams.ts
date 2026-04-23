import type { DailyHexagram } from "../types.js";

type TrigramDefinition = {
  key: string;
  name: string;
  nature: string;
  theme: string;
  focusTags: string[];
  avoidTags: string[];
};

const TRIGRAM_ORDER = ["111", "110", "101", "100", "011", "010", "001", "000"] as const;

const TRIGRAMS: Record<(typeof TRIGRAM_ORDER)[number], TrigramDefinition> = {
  "111": {
    key: "111",
    name: "乾",
    nature: "天",
    theme: "向上提气",
    focusTags: ["定主次", "稳步推进"],
    avoidTags: ["过满", "一口气顶到底"]
  },
  "110": {
    key: "110",
    name: "兑",
    nature: "泽",
    theme: "舒展松开",
    focusTags: ["放松肩面", "把呼吸拉长"],
    avoidTags: ["外放过头", "社交过量"]
  },
  "101": {
    key: "101",
    name: "离",
    nature: "火",
    theme: "明而不燥",
    focusTags: ["控火气", "减少晚间刺激"],
    avoidTags: ["辛辣叠加", "情绪上头"]
  },
  "100": {
    key: "100",
    name: "震",
    nature: "雷",
    theme: "起势有度",
    focusTags: ["先活动身体", "分段完成任务"],
    avoidTags: ["急冲", "硬撑不歇"]
  },
  "011": {
    key: "011",
    name: "巽",
    nature: "风",
    theme: "顺势疏理",
    focusTags: ["通气机", "把节奏理顺"],
    avoidTags: ["拖着不动", "反复消耗"]
  },
  "010": {
    key: "010",
    name: "坎",
    nature: "水",
    theme: "回收心气",
    focusTags: ["补水", "守住休息段"],
    avoidTags: ["寒凉过量", "熬夜透支"]
  },
  "001": {
    key: "001",
    name: "艮",
    nature: "山",
    theme: "先止后行",
    focusTags: ["做减法", "早点收尾"],
    avoidTags: ["久坐不动", "节奏过满"]
  },
  "000": {
    key: "000",
    name: "坤",
    nature: "地",
    theme: "稳稳承接",
    focusTags: ["顾脾胃", "把日常落稳"],
    avoidTags: ["饮食失序", "过度操心"]
  }
};

const HEXAGRAM_NAMES: string[][] = [
  ["乾为天", "泽天夬", "火天大有", "雷天大壮", "风天小畜", "水天需", "山天大畜", "地天泰"],
  ["天泽履", "兑为泽", "火泽睽", "雷泽归妹", "风泽中孚", "水泽节", "山泽损", "地泽临"],
  ["天火同人", "泽火革", "离为火", "雷火丰", "风火家人", "水火既济", "山火贲", "地火明夷"],
  ["天雷无妄", "泽雷随", "火雷噬嗑", "震为雷", "风雷益", "水雷屯", "山雷颐", "地雷复"],
  ["天风姤", "泽风大过", "火风鼎", "雷风恒", "巽为风", "水风井", "山风蛊", "地风升"],
  ["天水讼", "泽水困", "火水未济", "雷水解", "风水涣", "坎为水", "山水蒙", "地水师"],
  ["天山遁", "泽山咸", "火山旅", "雷山小过", "风山渐", "水山蹇", "艮为山", "地山谦"],
  ["天地否", "泽地萃", "火地晋", "雷地豫", "风地观", "水地比", "山地剥", "坤为地"]
];

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function buildSummary(lower: TrigramDefinition, upper: TrigramDefinition): {
  image: string;
  theme: string;
  focusTags: string[];
  avoidTags: string[];
} {
  return {
    image: `${upper.nature}在上，${lower.nature}在下`,
    theme: `${upper.theme}，也要${lower.theme}`,
    focusTags: dedupe([...upper.focusTags, ...lower.focusTags]).slice(0, 3),
    avoidTags: dedupe([...upper.avoidTags, ...lower.avoidTags]).slice(0, 2)
  };
}

export const HEXAGRAM_LIBRARY: DailyHexagram[] = TRIGRAM_ORDER.flatMap((lowerKey, lowerIndex) =>
  TRIGRAM_ORDER.map((upperKey, upperIndex) => {
    const lower = TRIGRAMS[lowerKey];
    const upper = TRIGRAMS[upperKey];
    const key = `${lowerKey}${upperKey}`;
    const summary = buildSummary(lower, upper);

    return {
      index: lowerIndex * TRIGRAM_ORDER.length + upperIndex,
      key,
      name: HEXAGRAM_NAMES[lowerIndex][upperIndex],
      lines: key.split("").map((line) => Number(line)),
      upperTrigram: upper.name,
      lowerTrigram: lower.name,
      image: summary.image,
      theme: summary.theme,
      focusTags: summary.focusTags,
      avoidTags: summary.avoidTags,
      headline: "",
      guidance: "",
      advice: [],
      cautions: []
    };
  })
);
