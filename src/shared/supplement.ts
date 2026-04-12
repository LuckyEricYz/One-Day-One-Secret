import {
  headSenseLabels,
  sleepDurationLabels,
  tongueCoatingLabels
} from "./labels.js";
import type { DailySupplement, HeadSense, SleepDuration, TongueCoating } from "../types.js";

export const defaultDailySupplement: DailySupplement = {
  headSense: "clear",
  sleepDuration: "medium",
  tongueCoating: "thin_white"
};

export const supplementQuestionCopy = {
  headSense: {
    title: "此刻你的头面体感更接近哪一种？",
    description: "只取今天的日常体感，不做医学判断。"
  },
  sleepDuration: {
    title: "昨晚的睡眠时长大概如何？",
    description: "只看连续睡眠的大致区间。"
  },
  tongueCoating: {
    title: "今天的舌苔观感更接近哪一种？",
    description: "按自然光下的直观感觉选择即可。"
  }
} as const;

export const supplementOptions = {
  headSense: [
    { value: "clear", label: headSenseLabels.clear },
    { value: "slightly_full", label: headSenseLabels.slightly_full },
    { value: "rising", label: headSenseLabels.rising }
  ] satisfies Array<{ value: HeadSense; label: string }>,
  sleepDuration: [
    { value: "short", label: sleepDurationLabels.short },
    { value: "medium", label: sleepDurationLabels.medium },
    { value: "long", label: sleepDurationLabels.long }
  ] satisfies Array<{ value: SleepDuration; label: string }>,
  tongueCoating: [
    { value: "thin_white", label: tongueCoatingLabels.thin_white },
    { value: "thick_white", label: tongueCoatingLabels.thick_white },
    { value: "slightly_yellow", label: tongueCoatingLabels.slightly_yellow }
  ] satisfies Array<{ value: TongueCoating; label: string }>
} as const;
