import type { Constitution, QuestionnaireAnswers, StoredProfile } from "../types";

type ConstitutionScoreBoard = Record<Constitution, number>;

function createEmptyBoard(): ConstitutionScoreBoard {
  return {
    balanced: 0,
    qi_deficiency: 0,
    yang_deficiency: 0,
    yin_deficiency: 0,
    qi_stagnation: 0,
    phlegm_dampness: 0
  };
}

function addScore(board: ConstitutionScoreBoard, constitution: Constitution, score: number): void {
  board[constitution] += score;
}

export function resolveConstitution(answers: QuestionnaireAnswers): Constitution {
  const board = createEmptyBoard();

  if (answers.bloodPressure === "high") addScore(board, "yin_deficiency", 2);
  if (answers.bloodPressure === "low") addScore(board, "qi_deficiency", 2);
  if (answers.bloodPressure === "steady") addScore(board, "balanced", 2);

  if (answers.sleepDuration === "short") {
    addScore(board, "yin_deficiency", 1);
    addScore(board, "qi_deficiency", 1);
  }
  if (answers.sleepDuration === "long") addScore(board, "phlegm_dampness", 1);
  if (answers.sleepDuration === "normal") addScore(board, "balanced", 2);

  if (answers.tongueCoating === "white_thick") addScore(board, "phlegm_dampness", 2);
  if (answers.tongueCoating === "red_thin") addScore(board, "yin_deficiency", 2);
  if (answers.tongueCoating === "pale_thin") addScore(board, "qi_deficiency", 1);

  const priority: Constitution[] = [
    "qi_stagnation",
    "phlegm_dampness",
    "yang_deficiency",
    "yin_deficiency",
    "qi_deficiency",
    "balanced"
  ];

  const highest = Math.max(...Object.values(board));
  const winners = priority.filter((item) => board[item] === highest);

  if (winners.length === 1) {
    return winners[0];
  }

  const nonBalanced = winners.filter((item) => item !== "balanced");
  return nonBalanced[0] ?? "balanced";
}

export function buildStoredProfile(answers: QuestionnaireAnswers, timestamp = Date.now()): StoredProfile {
  const iso = new Date(timestamp).toISOString();
  return {
    constitution: resolveConstitution(answers),
    healthTags: answers.healthTags,
    createdAt: iso,
    updatedAt: iso,
    version: 1
  };
}

