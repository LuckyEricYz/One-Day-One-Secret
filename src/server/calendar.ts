import { SOLAR_TERMS } from "./solarTerms.js";
import type { CalendarContext } from "../types.js";
import { getShanghaiDateKey } from "../shared/time.js";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const DAY_BASE = new Date("1984-02-02T00:00:00+08:00");

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function toShanghaiStartOfDay(timestamp: number): Date {
  const key = getShanghaiDateKey(timestamp);
  return new Date(`${key}T00:00:00+08:00`);
}

function createBoundaryDate(year: number, month: number, day: number): Date {
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return new Date(`${year}-${paddedMonth}-${paddedDay}T00:00:00+08:00`);
}

function getCurrentSolarTerm(timestamp: number) {
  const target = toShanghaiStartOfDay(timestamp);
  const year = Number(getShanghaiDateKey(timestamp).slice(0, 4));

  const boundaries = SOLAR_TERMS.map((term) => ({
    term,
    date: createBoundaryDate(year, term.month, term.day)
  }));

  let current = boundaries[boundaries.length - 1];
  let next = { term: SOLAR_TERMS[0], date: createBoundaryDate(year + 1, SOLAR_TERMS[0].month, SOLAR_TERMS[0].day) };

  for (let index = 0; index < boundaries.length; index += 1) {
    const candidate = boundaries[index];
    if (target >= candidate.date) {
      current = candidate;
      next =
        boundaries[index + 1] ?? {
          term: SOLAR_TERMS[0],
          date: createBoundaryDate(year + 1, SOLAR_TERMS[0].month, SOLAR_TERMS[0].day)
        };
    }
  }

  if (target < boundaries[0].date) {
    current = {
      term: SOLAR_TERMS[SOLAR_TERMS.length - 1],
      date: createBoundaryDate(year - 1, SOLAR_TERMS[SOLAR_TERMS.length - 1].month, SOLAR_TERMS[SOLAR_TERMS.length - 1].day)
    };
    next = boundaries[0];
  }

  const elapsedDays = Math.floor((target.getTime() - current.date.getTime()) / 86400000) + 1;
  const solarTermStage: CalendarContext["solarTermStage"] =
    elapsedDays <= 4 ? "start" : elapsedDays <= 10 ? "middle" : "end";

  return {
    term: current.term,
    start: current.date,
    next: next.date,
    solarTermStage
  };
}

function getYearGanZhi(timestamp: number, lichunBoundary: Date) {
  const startOfDay = toShanghaiStartOfDay(timestamp);
  const gregorianYear = Number(getShanghaiDateKey(timestamp).slice(0, 4));
  const solarYear = startOfDay >= lichunBoundary ? gregorianYear : gregorianYear - 1;
  const stemIndex = mod(solarYear - 4, 10);
  const branchIndex = mod(solarYear - 4, 12);

  return {
    stemIndex,
    branchIndex,
    label: `${STEMS[stemIndex]}${BRANCHES[branchIndex]}`
  };
}

function getMonthGanZhi(yearStemIndex: number, monthNumber: number) {
  const monthBranchIndex = mod(monthNumber + 1, 12);
  const startStemIndexByYearStem = [2, 4, 6, 8, 0][yearStemIndex % 5];
  const monthStemIndex = mod(startStemIndexByYearStem + monthNumber - 1, 10);

  return `${STEMS[monthStemIndex]}${BRANCHES[monthBranchIndex]}`;
}

function getDayGanZhi(timestamp: number) {
  const startOfDay = toShanghaiStartOfDay(timestamp);
  const diffDays = Math.floor((startOfDay.getTime() - DAY_BASE.getTime()) / 86400000);
  const stemIndex = mod(2 + diffDays, 10);
  const branchIndex = mod(2 + diffDays, 12);

  return `${STEMS[stemIndex]}${BRANCHES[branchIndex]}`;
}

export function getCalendarContext(timestamp: number): CalendarContext {
  const lichun = createBoundaryDate(Number(getShanghaiDateKey(timestamp).slice(0, 4)), 2, 4);
  const solarTerm = getCurrentSolarTerm(timestamp);
  const yearGanZhi = getYearGanZhi(timestamp, lichun);
  const monthGanZhi = getMonthGanZhi(yearGanZhi.stemIndex, solarTerm.term.monthNumber);
  const dayGanZhi = getDayGanZhi(timestamp);

  return {
    solarTermKey: solarTerm.term.key,
    solarTermName: solarTerm.term.name,
    solarTermStage: solarTerm.solarTermStage,
    ganZhiSummary: `${yearGanZhi.label}年 ${monthGanZhi}月 ${dayGanZhi}日`,
    dateKey: getShanghaiDateKey(timestamp)
  };
}
