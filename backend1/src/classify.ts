import type { Evaluation, MoveAnnotation } from "./types.js";

const INACCURACY_LOSS = 50;
const MISTAKE_LOSS = 100;
const BLUNDER_LOSS = 200;

export function scoreToCp(evaluation: Evaluation): number {
  if (evaluation.type === "mate") {
    if (evaluation.value > 0) {
      return 30_000 - evaluation.value;
    }
    if (evaluation.value < 0) {
      return -30_000 + evaluation.value;
    }
    return 0;
  }
  return evaluation.value;
}

export function evalLoss(best: Evaluation, played: Evaluation): number {
  return Math.max(0, scoreToCp(best) - scoreToCp(played));
}

export function toWhiteEvaluation(
  score: Evaluation,
  sideToMove: "w" | "b",
): Evaluation {
  if (sideToMove === "w") {
    return score;
  }
  return { type: score.type, value: -score.value };
}

export function classifyLoss(
  lossCp: number,
  inBook: boolean,
): MoveAnnotation | undefined {
  if (inBook) {
    return { kind: "book", glyph: "book" };
  }
  if (lossCp >= BLUNDER_LOSS) {
    return { kind: "blunder", glyph: "??" };
  }
  if (lossCp >= MISTAKE_LOSS) {
    return { kind: "mistake", glyph: "?" };
  }
  if (lossCp >= INACCURACY_LOSS) {
    return { kind: "inaccuracy", glyph: "?!" };
  }
  return undefined;
}
