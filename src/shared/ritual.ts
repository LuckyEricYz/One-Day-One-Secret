import type { HexagramContext, Mood } from "../types.js";

type Trigram = {
  key: string;
  name: string;
  nature: string;
  mood: string;
};

const TRIGRAMS: Record<string, Trigram> = {
  "111": { key: "111", name: "乾", nature: "天", mood: "主动、上扬" },
  "110": { key: "110", name: "兑", nature: "泽", mood: "舒展、外放" },
  "101": { key: "101", name: "离", nature: "火", mood: "明亮、易燥" },
  "100": { key: "100", name: "震", nature: "雷", mood: "起势、易急" },
  "011": { key: "011", name: "巽", nature: "风", mood: "流动、入微" },
  "010": { key: "010", name: "坎", nature: "水", mood: "收敛、内沉" },
  "001": { key: "001", name: "艮", nature: "山", mood: "止息、收口" },
  "000": { key: "000", name: "坤", nature: "地", mood: "承载、缓和" }
};

const HEXAGRAM_NAME_MAP: Record<string, string> = {
  "111111": "乾为天",
  "000000": "坤为地",
  "111100": "雷天大壮",
  "100010": "水雷屯",
  "010001": "山水蒙",
  "101011": "风火家人",
  "010111": "天水讼",
  "111010": "水天需",
  "110111": "天泽履",
  "111000": "天地否",
  "000111": "地天泰",
  "101101": "离为火",
  "010010": "坎为水",
  "001001": "艮为山",
  "011011": "巽为风",
  "110110": "兑为泽",
  "100100": "震为雷"
};

const moodPreviewTails: Record<Mood, string[]> = {
  happy: ["留三分余地", "轻快也别太满", "今天宜稳着发力"],
  calm: ["把节律守住", "让日常缓缓落位", "今天宜按步而行"],
  tired: ["先把气力收回", "今天宜缓缓补气", "先给身体留余温"],
  anxious: ["先把心火按下", "今天宜减噪定神", "先撤掉多余刺激"],
  sad: ["先照顾起居温度", "今天宜慢慢回暖", "先让身体动一点"],
  angry: ["先离开点火处", "今天宜收躁留白", "先把火气散掉"]
};

const hexagramPreviewHeads: Array<{ pattern: RegExp; lines: string[] }> = [
  { pattern: /雷/u, lines: ["雷意初起", "有动象显形", "起势已经到了"] },
  { pattern: /水/u, lines: ["水意回旋", "气机先收一收", "先让心气归位"] },
  { pattern: /山/u, lines: ["山意落定", "今天先做减法", "此刻宜稳住脚步"] },
  { pattern: /风/u, lines: ["风意入微", "细处更见天机", "顺势把脉络理开"] },
  { pattern: /火/u, lines: ["火意微明", "亮处也要留余", "今天宜明而不燥"] },
  { pattern: /泽/u, lines: ["泽意舒展", "松弛里仍要有界", "今日宜缓展不外溢"] },
  { pattern: /地/u, lines: ["地意承载", "脚步先落到实处", "今日宜安稳成形"] },
  { pattern: /天/u, lines: ["天气上行", "向上时也别过满", "此刻宜有进有留"] }
];

function normalizeLineValue(lineValue: number): {
  current: 0 | 1;
  changed: 0 | 1;
  changing: boolean;
} {
  if (lineValue === 0) return { current: 0, changed: 1, changing: true };
  if (lineValue === 1) return { current: 1, changed: 1, changing: false };
  if (lineValue === 2) return { current: 0, changed: 0, changing: false };
  return { current: 1, changed: 0, changing: true };
}

function nextSeed(seed: number): number {
  let next = seed >>> 0;

  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;

  return next >>> 0;
}

function describeHexagram(key: string): { name: string; summary: string } {
  const lower = TRIGRAMS[key.slice(0, 3)];
  const upper = TRIGRAMS[key.slice(3)];
  const mappedName = HEXAGRAM_NAME_MAP[key];

  return {
    name: mappedName ?? `${upper.nature}${lower.nature}之象`,
    summary:
      `${upper.nature}在上，${lower.nature}在下，呈现${upper.mood}与${lower.mood}并行的状态。今天宜先稳住节奏，再决定是否加力。`
  };
}

function buildStableSeed(...parts: Array<string | number>): number {
  return parts.join("|").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pickPreviewHead(hexagramName: string, seed: number): string {
  const matched =
    hexagramPreviewHeads.find((item) => item.pattern.test(hexagramName))?.lines ?? [
      "卦象已经显形",
      "此刻天机已聚",
      "先让节奏慢慢落稳"
    ];

  return matched[seed % matched.length];
}

export function buildPreviewCue(hexagram: HexagramContext, mood: Mood): string {
  const seed = buildStableSeed(hexagram.key, hexagram.name, mood);
  const head = pickPreviewHead(hexagram.name, seed);
  const tailOptions = moodPreviewTails[mood];
  const tail = tailOptions[seed % tailOptions.length];

  return `${head}，${tail}`;
}

export function getHexagramContext(
  pressDurationMs: number,
  timestamp: number,
  touchEntropy = 0
): HexagramContext {
  let seed = (pressDurationMs * 131 + (timestamp % 100000) + touchEntropy) >>> 0;
  const lines: number[] = [];
  const changedLines: number[] = [];
  const changedCandidate: number[] = [];

  for (let index = 0; index < 6; index += 1) {
    seed = nextSeed(seed);
    const normalized = normalizeLineValue((seed >>> 24) & 0b11);
    lines.push(normalized.current);
    changedCandidate.push(normalized.changed);
    if (normalized.changing) {
      changedLines.push(index + 1);
    }
  }

  const key = lines.join("");
  const changedKey = changedLines.length ? changedCandidate.join("") : null;
  const current = describeHexagram(key);
  const changed = changedKey ? describeHexagram(changedKey) : null;

  return {
    key,
    name: current.name,
    changedName: changed?.name ?? null,
    lines,
    changingLines: changedLines,
    summary: current.summary
  };
}
