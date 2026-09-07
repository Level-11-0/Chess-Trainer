import { Chess, type PieceSymbol, type Square } from "chess.js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { classifyLoss, evalLoss, toWhiteEvaluation } from "./classify.js";
import { analyzeLines, flipEvaluation } from "./engine.js";
import { lookupBookMove, toUci } from "./openingBook.js";
import { DATA_DIR } from "./paths.js";
import {
  ANALYZE_DEPTH,
  ANALYZE_MULTI_PV,
  MAX_REVIEW_PLIES,
  type GameReview,
  type ReviewListItem,
  type ReviewSummary,
  type ReviewedMove,
} from "./types.js";

const REVIEWS_PATH = join(DATA_DIR, "reviews.json");

const reviews = new Map<string, GameReview>();
let loaded = false;

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

function emptySummary(): ReviewSummary {
  return { inaccuracies: 0, mistakes: 0, blunders: 0, worst: [] };
}

function toListItem(review: GameReview): ReviewListItem {
  return {
    id: review.id,
    white: review.white,
    black: review.black,
    result: review.result,
    event: review.event,
    date: review.date,
    status: review.status,
    progress: review.progress,
    summary: review.summary,
    createdAt: review.createdAt,
  };
}

async function ensureLoaded(): Promise<void> {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const raw = await readFile(REVIEWS_PATH, "utf8");
    const parsed = JSON.parse(raw) as { reviews?: GameReview[] };
    for (const review of parsed.reviews ?? []) {
      if (review.status === "analyzing") {
        review.status = "error";
        review.error = "Analysis interrupted. Upload the PGN again.";
      }
      reviews.set(review.id, review);
    }
  } catch {
    /* first run */
  }
}

async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const saved = [...reviews.values()].filter((review) => review.userId);
  await writeFile(
    REVIEWS_PATH,
    `${JSON.stringify({ reviews: saved }, null, 2)}\n`,
    "utf8",
  );
}

function headerValue(chess: Chess, key: string, fallback: string): string {
  const value = chess.header()[key];
  return value && value !== "?" ? value : fallback;
}

function summarize(moves: ReviewedMove[]): ReviewSummary {
  const flagged = moves.filter(
    (move) =>
      move.annotation &&
      (move.annotation.kind === "inaccuracy" ||
        move.annotation.kind === "mistake" ||
        move.annotation.kind === "blunder"),
  );
  const worst = [...flagged]
    .sort((a, b) => b.lossCp - a.lossCp)
    .slice(0, 8)
    .map((move) => ({
      ply: move.ply,
      san: move.san,
      color: move.color,
      lossCp: move.lossCp,
      kind: move.annotation?.kind ?? "inaccuracy",
    }));
  return {
    inaccuracies: flagged.filter((move) => move.annotation?.kind === "inaccuracy")
      .length,
    mistakes: flagged.filter((move) => move.annotation?.kind === "mistake").length,
    blunders: flagged.filter((move) => move.annotation?.kind === "blunder").length,
    worst,
  };
}

async function analyzeReview(review: GameReview): Promise<void> {
  const loaded = new Chess();
  loaded.loadPgn(review.pgn);
  const played = loaded.history({ verbose: true }).slice(0, MAX_REVIEW_PLIES);
  const replay = new Chess();
  const moves: ReviewedMove[] = [];
  review.progress.total = played.length;

  for (const [index, move] of played.entries()) {
    const fenBefore = replay.fen();
    const playedUci = toUci(move.from, move.to, move.promotion);
    const { bestmove, lines } = await analyzeLines(
      fenBefore,
      ANALYZE_DEPTH,
      ANALYZE_MULTI_PV,
    );
    const bestLine = lines[0];
    let playedEval = lines.find((line) => line.uci === playedUci)?.evaluation;
    if (!playedEval) {
      const probe = new Chess(fenBefore);
      probe.move({
        from: move.from as Square,
        to: move.to as Square,
        ...(move.promotion
          ? { promotion: move.promotion as PieceSymbol }
          : {}),
      });
      if (probe.isCheckmate()) {
        playedEval = { type: "mate", value: 1 };
      } else if (probe.isGameOver()) {
        playedEval = { type: "cp", value: 0 };
      } else {
        const after = await analyzeLines(probe.fen(), ANALYZE_DEPTH, 1);
        const opp = after.lines[0]?.evaluation;
        playedEval = opp ? flipEvaluation(opp) : { type: "cp", value: 0 };
      }
    }

    const bestEval = bestLine?.evaluation ?? playedEval;
    const lossCp = evalLoss(bestEval, playedEval);
    const bookHit = await lookupBookMove(fenBefore, playedUci);
    const annotation = classifyLoss(lossCp, Boolean(bookHit));

    replay.move({
      from: move.from as Square,
      to: move.to as Square,
      ...(move.promotion ? { promotion: move.promotion as PieceSymbol } : {}),
    });

    const reviewed: ReviewedMove = {
      ply: index + 1,
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
      fen: replay.fen(),
      evaluation: toWhiteEvaluation(playedEval, move.color),
      bestEvaluation: toWhiteEvaluation(bestEval, move.color),
      lossCp,
      bestMove: bestmove && bestmove !== playedUci ? bestmove : undefined,
    };
    if (move.promotion) {
      reviewed.promotion = move.promotion;
    }
    if (annotation) {
      reviewed.annotation = annotation;
    }
    if (bookHit) {
      reviewed.openingName = bookHit.openingName;
    }
    moves.push(reviewed);
    review.moves = moves;
    review.progress = { analyzed: index + 1, total: played.length };
  }

  review.moves = moves;
  review.summary = summarize(moves);
  review.status = "ready";
  await persist();
}

function shouldPersist(userId: string): boolean {
  return userId.length > 0;
}

export async function createReview(
  userId: string | null,
  pgn: string,
): Promise<GameReview> {
  await ensureLoaded();
  const trimmed = pgn.trim();
  if (trimmed.length < 10) {
    throw httpError("Paste or upload a PGN game", 400);
  }
  if (trimmed.length > 200_000) {
    throw httpError("PGN is too large", 400);
  }

  const chess = new Chess();
  try {
    chess.loadPgn(trimmed);
  } catch {
    throw httpError("Could not parse that PGN", 400);
  }
  if (chess.history().length === 0) {
    throw httpError("That PGN has no moves", 400);
  }

  const review: GameReview = {
    id: randomUUID(),
    userId: userId ?? "",
    pgn: trimmed,
    white: headerValue(chess, "White", "White"),
    black: headerValue(chess, "Black", "Black"),
    result: headerValue(chess, "Result", "*"),
    event: headerValue(chess, "Event", "Casual game"),
    date: headerValue(chess, "Date", ""),
    status: "analyzing",
    progress: { analyzed: 0, total: chess.history().length },
    startingFen: new Chess().fen(),
    moves: [],
    summary: emptySummary(),
    createdAt: new Date().toISOString(),
  };
  reviews.set(review.id, review);
  if (shouldPersist(review.userId)) {
    await persist();
  }

  void analyzeReview(review)
    .then(async () => {
      if (shouldPersist(review.userId)) {
        await persist();
      }
    })
    .catch(async (error: unknown) => {
      review.status = "error";
      review.error = error instanceof Error ? error.message : "Analysis failed";
      if (shouldPersist(review.userId)) {
        await persist();
      }
    });

  return review;
}

export async function listReviews(userId: string): Promise<ReviewListItem[]> {
  await ensureLoaded();
  return [...reviews.values()]
    .filter((review) => review.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toListItem);
}

export async function getReview(
  id: string,
  userId: string | null,
): Promise<GameReview> {
  await ensureLoaded();
  const review = reviews.get(id);
  if (!review) {
    throw httpError("Review not found", 404);
  }
  if (review.userId && review.userId !== userId) {
    throw httpError("Review not found", 404);
  }
  return review;
}

export { toListItem };
