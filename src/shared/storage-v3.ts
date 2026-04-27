import {
  BIRTH_HOUR_BRANCHES,
  GENDERS,
  type DailySnapshot,
  type HistoryEntryV3,
  type StoredUserProfileV3
} from "../types.js";

export const STORAGE_V3_KEYS = {
  profile: "tianji_v3_profile",
  history: "tianji_v3_history",
  modalSeen: "tianji_v3_modal_seen",
  profileSchema: "tianji_v3_profile_schema"
} as const;

const LEGACY_STORAGE_KEYS = [
  "tianji_v2_role_id",
  "tianji_v2_history",
  "tianji_v2_modal_seen",
  "tianji_v2_role_schema"
] as const;

const PROFILE_SCHEMA_VERSION = "personal_profile_v1";

function isGender(value: unknown): value is StoredUserProfileV3["gender"] {
  return GENDERS.includes(value as StoredUserProfileV3["gender"]);
}

function isBirthHourBranch(value: unknown): value is NonNullable<StoredUserProfileV3["birthHourBranch"]> {
  return BIRTH_HOUR_BRANCHES.includes(value as NonNullable<StoredUserProfileV3["birthHourBranch"]>);
}

function isDateString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

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

export function isStoredUserProfileV3(value: unknown): value is StoredUserProfileV3 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as StoredUserProfileV3;
  return (
    profile.version === 1 &&
    isGender(profile.gender) &&
    isDateString(profile.birthDate) &&
    (profile.birthHourBranch === null || isBirthHourBranch(profile.birthHourBranch)) &&
    isNonEmptyString(profile.birthPlace) &&
    isNonEmptyString(profile.currentPlace) &&
    isNonEmptyString(profile.createdAt) &&
    isNonEmptyString(profile.updatedAt)
  );
}

export function ensureCurrentProfileStorageSchema(): void {
  if (typeof window === "undefined") {
    return;
  }

  LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));

  if (window.localStorage.getItem(STORAGE_V3_KEYS.profileSchema) === PROFILE_SCHEMA_VERSION) {
    return;
  }

  window.localStorage.removeItem(STORAGE_V3_KEYS.profile);
  window.localStorage.removeItem(STORAGE_V3_KEYS.history);
  window.localStorage.removeItem(STORAGE_V3_KEYS.modalSeen);
  window.localStorage.setItem(STORAGE_V3_KEYS.profileSchema, PROFILE_SCHEMA_VERSION);
}

export function getStoredProfileV3(): StoredUserProfileV3 | null {
  const profile = readJson<unknown | null>(STORAGE_V3_KEYS.profile, null);
  return isStoredUserProfileV3(profile) ? profile : null;
}

export function saveStoredProfileV3(profile: StoredUserProfileV3): void {
  writeJson(STORAGE_V3_KEYS.profile, {
    ...profile,
    birthPlace: profile.birthPlace.trim(),
    currentPlace: profile.currentPlace.trim()
  });
}

export function getStoredHistoryV3(): HistoryEntryV3[] {
  return readJson<unknown[]>(STORAGE_V3_KEYS.history, []).filter(
    (entry): entry is HistoryEntryV3 =>
      Boolean(
        entry &&
          typeof entry === "object" &&
          isNonEmptyString((entry as HistoryEntryV3).profileHash) &&
          isNonEmptyString((entry as HistoryEntryV3).snapshot?.profileHash)
      )
  );
}

export function mergeHistoryEntries(
  existingEntries: HistoryEntryV3[],
  snapshot: DailySnapshot
): HistoryEntryV3[] {
  const nextEntry: HistoryEntryV3 = {
    id: snapshot.id,
    profileHash: snapshot.profileHash,
    dateKey: snapshot.dateKey,
    savedAt: snapshot.generatedAt,
    snapshot
  };

  return [nextEntry, ...existingEntries.filter((item) => item.id !== snapshot.id)]
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey) || right.savedAt.localeCompare(left.savedAt))
    .slice(0, 180);
}

export function upsertStoredHistoryEntry(snapshot: DailySnapshot): HistoryEntryV3[] {
  const next = mergeHistoryEntries(getStoredHistoryV3(), snapshot);
  writeJson(STORAGE_V3_KEYS.history, next);
  return next;
}

function getModalSeenMap(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(STORAGE_V3_KEYS.modalSeen, {});
}

export function isDailyModalSeen(key: string): boolean {
  return Boolean(getModalSeenMap()[key]);
}

export function markDailyModalSeen(key: string): void {
  const current = getModalSeenMap();
  writeJson(STORAGE_V3_KEYS.modalSeen, {
    ...current,
    [key]: true
  });
}
