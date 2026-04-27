import { buildDailySnapshot } from "../src/shared/daily.js";
import { mergeHistoryEntries } from "../src/shared/storage-v3.js";
import type { StoredUserProfileV3 } from "../src/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const PROFILE_A: StoredUserProfileV3 = {
  gender: "male",
  birthDate: "1992-08-18",
  birthHourBranch: "chen",
  birthPlace: "杭州",
  currentPlace: "上海",
  createdAt: "2026-04-22T01:00:00.000Z",
  updatedAt: "2026-04-22T01:00:00.000Z",
  version: 1
};

const PROFILE_B: StoredUserProfileV3 = {
  gender: "female",
  birthDate: "1995-12-06",
  birthHourBranch: null,
  birthPlace: "成都",
  currentPlace: "北京",
  createdAt: "2026-04-22T01:00:00.000Z",
  updatedAt: "2026-04-22T01:00:00.000Z",
  version: 1
};

function stringifySnapshot(profile: StoredUserProfileV3, timestamp: number) {
  return JSON.stringify(buildDailySnapshot(profile, timestamp));
}

function testDeterministicSnapshot() {
  const timestamp = Date.parse("2026-04-22T09:30:00+08:00");
  const left = stringifySnapshot(PROFILE_A, timestamp);
  const right = stringifySnapshot(PROFILE_A, timestamp);

  assert(left === right, "same profile and date should generate identical snapshots");
}

function testProfileDifference() {
  const timestamp = Date.parse("2026-04-22T09:30:00+08:00");
  const profileA = buildDailySnapshot(PROFILE_A, timestamp);
  const profileB = buildDailySnapshot(PROFILE_B, timestamp);

  assert(profileA.profileHash !== profileB.profileHash, "different profiles should not share the same hash");
  assert(
    profileA.hexagram.headline !== profileB.hexagram.headline ||
      profileA.recipe.name !== profileB.recipe.name ||
      profileA.acupoint.name !== profileB.acupoint.name,
    "profiles should differ in at least one homepage module"
  );
}

function testCrossDayRotation() {
  const first = buildDailySnapshot(PROFILE_B, Date.parse("2026-04-22T22:30:00+08:00"));
  const second = buildDailySnapshot(PROFILE_B, Date.parse("2026-04-23T00:30:00+08:00"));

  assert(first.dateKey !== second.dateKey, "cross-day timestamps should generate different date keys");
  assert(first.id !== second.id, "cross-day snapshots should not reuse the same history id");
}

function testHistoryDeduplication() {
  const snapshot = buildDailySnapshot(PROFILE_A, Date.parse("2026-04-22T09:30:00+08:00"));
  const once = mergeHistoryEntries([], snapshot);
  const twice = mergeHistoryEntries(once, snapshot);

  assert(once.length === 1, "first history insert should create one item");
  assert(twice.length === 1, "same profile and date should not create duplicate history entries");
}

function testCopySafety() {
  const snapshot = buildDailySnapshot(PROFILE_B, Date.parse("2026-12-21T10:00:00+08:00"));
  const textBlob = JSON.stringify(snapshot);
  const bannedWords = ["诊断", "治疗", "保健品", "药物推荐"];

  bannedWords.forEach((word) => {
    assert(!textBlob.includes(word), `snapshot should not contain banned word: ${word}`);
  });
}

function main() {
  testDeterministicSnapshot();
  testProfileDifference();
  testCrossDayRotation();
  testHistoryDeduplication();
  testCopySafety();

  console.info("daily rules ok");
}

main();
