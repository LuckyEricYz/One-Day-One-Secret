import { buildDailySnapshot } from "../src/shared/daily.js";
import { mergeHistoryEntries } from "../src/shared/storage-v2.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function stringifySnapshot(roleId: "male" | "female", timestamp: number) {
  return JSON.stringify(buildDailySnapshot(roleId, timestamp));
}

function testDeterministicSnapshot() {
  const timestamp = Date.parse("2026-04-22T09:30:00+08:00");
  const left = stringifySnapshot("male", timestamp);
  const right = stringifySnapshot("male", timestamp);

  assert(left === right, "same role and date should generate identical snapshots");
}

function testRoleDifference() {
  const timestamp = Date.parse("2026-04-22T09:30:00+08:00");
  const male = buildDailySnapshot("male", timestamp);
  const female = buildDailySnapshot("female", timestamp);

  assert(male.hexagram.name !== female.hexagram.name, "roles should not share the same daily hexagram");
  assert(
    male.hexagram.headline !== female.hexagram.headline ||
      male.recipe.name !== female.recipe.name ||
      male.acupoint.name !== female.acupoint.name,
    "roles should differ in at least one homepage module"
  );
}

function testCrossDayRotation() {
  const first = buildDailySnapshot("female", Date.parse("2026-04-22T22:30:00+08:00"));
  const second = buildDailySnapshot("female", Date.parse("2026-04-23T00:30:00+08:00"));

  assert(first.dateKey !== second.dateKey, "cross-day timestamps should generate different date keys");
  assert(first.id !== second.id, "cross-day snapshots should not reuse the same history id");
}

function testHistoryDeduplication() {
  const snapshot = buildDailySnapshot("male", Date.parse("2026-04-22T09:30:00+08:00"));
  const once = mergeHistoryEntries([], snapshot);
  const twice = mergeHistoryEntries(once, snapshot);

  assert(once.length === 1, "first history insert should create one item");
  assert(twice.length === 1, "same role and date should not create duplicate history entries");
}

function testCopySafety() {
  const snapshot = buildDailySnapshot("female", Date.parse("2026-12-21T10:00:00+08:00"));
  const textBlob = JSON.stringify(snapshot);
  const bannedWords = ["诊断", "治疗", "保健品", "药物推荐"];

  bannedWords.forEach((word) => {
    assert(!textBlob.includes(word), `snapshot should not contain banned word: ${word}`);
  });
}

function main() {
  testDeterministicSnapshot();
  testRoleDifference();
  testCrossDayRotation();
  testHistoryDeduplication();
  testCopySafety();

  console.info("daily rules ok");
}

main();
