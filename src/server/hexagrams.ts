import type { HexagramContext } from "../types";

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

  // Avoid low-bit repetition from the old LCG implementation, which made `% 4`
  // collapse into near-constant line values and repeated hexagrams.
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
