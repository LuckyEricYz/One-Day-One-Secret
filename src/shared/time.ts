export const SHANGHAI_TIMEZONE = "Asia/Shanghai";
export const MAX_DAILY_QUOTA = 5;

export function getShanghaiDateKey(timestamp = Date.now()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(new Date(timestamp));
}

export function getShanghaiNowIso(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString();
}

export function getNextShanghaiMidnightIso(timestamp = Date.now()): string {
  const nextDateKey = getShanghaiDateKey(timestamp + 24 * 60 * 60 * 1000);
  return `${nextDateKey}T00:00:00+08:00`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: SHANGHAI_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}
