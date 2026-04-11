import type { HistoryEntry, QuotaSnapshot, StoredProfile } from "../types";
import { MAX_DAILY_QUOTA, getShanghaiDateKey } from "./time";

export const STORAGE_KEYS = {
  clientId: "tianji_client_id",
  profile: "tianji_profile",
  history: "tianji_history",
  quota: "tianji_quota"
} as const;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function ensureClientId(): string {
  if (typeof window === "undefined") {
    return "server-side-client";
  }

  const existing = window.localStorage.getItem(STORAGE_KEYS.clientId);
  if (existing) {
    return existing;
  }

  const next = window.crypto?.randomUUID?.() ?? `client-${Date.now()}`;
  window.localStorage.setItem(STORAGE_KEYS.clientId, next);
  return next;
}

export function getStoredProfile(): StoredProfile | null {
  return readJson<StoredProfile | null>(STORAGE_KEYS.profile, null);
}

export function saveStoredProfile(profile: StoredProfile): void {
  writeJson(STORAGE_KEYS.profile, profile);
}

export function getStoredHistory(): HistoryEntry[] {
  const entries = readJson<HistoryEntry[]>(STORAGE_KEYS.history, []);
  return [...entries].sort((a, b) =>
    b.result.meta.generatedAt.localeCompare(a.result.meta.generatedAt)
  );
}

export function appendHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...getStoredHistory()].filter((item) => {
    const generatedAt = Date.parse(item.result.meta.generatedAt);
    return Number.isFinite(generatedAt) && generatedAt > Date.now() - 90 * 24 * 60 * 60 * 1000;
  });

  writeJson(STORAGE_KEYS.history, next);
  return next;
}

export function getQuotaSnapshot(timestamp = Date.now()): QuotaSnapshot {
  const date = getShanghaiDateKey(timestamp);
  const current = readJson<QuotaSnapshot | null>(STORAGE_KEYS.quota, null);

  if (!current || current.date !== date) {
    const fresh = { date, count: 0, maxPerDay: MAX_DAILY_QUOTA };
    writeJson(STORAGE_KEYS.quota, fresh);
    return fresh;
  }

  return current;
}

export function incrementLocalQuota(timestamp = Date.now()): QuotaSnapshot {
  const current = getQuotaSnapshot(timestamp);
  const next = {
    ...current,
    count: Math.min(current.maxPerDay, current.count + 1)
  };
  writeJson(STORAGE_KEYS.quota, next);
  return next;
}

export function applyServerRemainingQuota(remainingQuota: number, timestamp = Date.now()): QuotaSnapshot {
  const current = getQuotaSnapshot(timestamp);
  const derivedCount = Math.max(0, current.maxPerDay - remainingQuota);
  const next = {
    ...current,
    count: Math.max(current.count, derivedCount)
  };
  writeJson(STORAGE_KEYS.quota, next);
  return next;
}

export function getRemainingLocalQuota(timestamp = Date.now()): number {
  const current = getQuotaSnapshot(timestamp);
  return Math.max(0, current.maxPerDay - current.count);
}

export function clearAllLocalData(): void {
  if (typeof window === "undefined") {
    return;
  }

  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
}

