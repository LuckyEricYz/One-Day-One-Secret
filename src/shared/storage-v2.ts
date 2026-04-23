import type { DailySnapshot, HistoryEntryV2, RoleId } from "../types.js";

export const STORAGE_V2_KEYS = {
  roleId: "tianji_v2_role_id",
  history: "tianji_v2_history",
  modalSeen: "tianji_v2_modal_seen"
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

export function getStoredRoleId(): RoleId | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(STORAGE_V2_KEYS.roleId);
  return value === "male" || value === "female" ? value : null;
}

export function saveStoredRoleId(roleId: RoleId): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_V2_KEYS.roleId, roleId);
}

export function getStoredHistoryV2(): HistoryEntryV2[] {
  return readJson<HistoryEntryV2[]>(STORAGE_V2_KEYS.history, []);
}

export function mergeHistoryEntries(
  existingEntries: HistoryEntryV2[],
  snapshot: DailySnapshot
): HistoryEntryV2[] {
  const nextEntry: HistoryEntryV2 = {
    id: snapshot.id,
    roleId: snapshot.roleId,
    dateKey: snapshot.dateKey,
    savedAt: snapshot.generatedAt,
    snapshot
  };

  return [nextEntry, ...existingEntries.filter((item) => item.id !== snapshot.id)]
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey) || right.savedAt.localeCompare(left.savedAt))
    .slice(0, 180);
}

export function upsertStoredHistoryEntry(snapshot: DailySnapshot): HistoryEntryV2[] {
  const next = mergeHistoryEntries(getStoredHistoryV2(), snapshot);
  writeJson(STORAGE_V2_KEYS.history, next);
  return next;
}

function getModalSeenMap(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(STORAGE_V2_KEYS.modalSeen, {});
}

export function isDailyModalSeen(key: string): boolean {
  return Boolean(getModalSeenMap()[key]);
}

export function markDailyModalSeen(key: string): void {
  const current = getModalSeenMap();
  writeJson(STORAGE_V2_KEYS.modalSeen, {
    ...current,
    [key]: true
  });
}
