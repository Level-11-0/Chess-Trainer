import { Chess, type PieceSymbol, type Square } from "chess.js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./paths.js";
import {
  MAX_BOOK_PLIES,
  type BookMove,
  type BookSource,
  type OpeningCourse,
  type OpeningLine,
  type TrainerTryResult,
} from "./types.js";

const BOOK_PATH = join(DATA_DIR, "book.json");

type StoredBook = {
  positions: Record<string, BookMove[]>;
  sources: BookSource[];
};

let book: StoredBook = { positions: {}, sources: [] };
let loaded = false;

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export function toUci(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion ?? ""}`;
}

export function fenKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

function headerOf(chess: Chess, key: string): string {
  const value = chess.header()[key];
  return value && value !== "?" ? value : "";
}

export function openingNameFromHeaders(chess: Chess): string {
  const opening = headerOf(chess, "Opening");
  if (opening) {
    return opening;
  }
  const eco = headerOf(chess, "ECO");
  const event = headerOf(chess, "Event");
  if (eco && event) {
    return `${eco}: ${event}`;
  }
  if (eco) {
    return eco;
  }
  if (event && event !== "Casual game") {
    return event;
  }
  return "Unnamed opening";
}

function previewSan(moves: { san: string; color: "w" | "b" }[]): string {
  const parts: string[] = [];
  let number = 1;
  for (const move of moves.slice(0, 8)) {
    if (move.color === "w") {
      parts.push(`${number}. ${move.san}`);
      number += 1;
    } else if (parts.length === 0) {
      parts.push(`${number}... ${move.san}`);
      number += 1;
    } else {
      parts.push(move.san);
    }
  }
  return parts.join(" ");
}

function splitPgnGames(pgn: string): string[] {
  const trimmed = pgn.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(/\n(?=\[Event )/)
    .map((game) => game.trim())
    .filter((game) => game.length > 0);
}

async function ensureLoaded(): Promise<void> {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const raw = await readFile(BOOK_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoredBook;
    book = {
      positions: parsed.positions ?? {},
      sources: parsed.sources ?? [],
    };
  } catch {
    book = { positions: {}, sources: [] };
  }
}

async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(BOOK_PATH, `${JSON.stringify(book, null, 2)}\n`, "utf8");
}

function addMove(fenBefore: string, move: BookMove): void {
  const key = fenKey(fenBefore);
  const existing = book.positions[key] ?? [];
  if (existing.some((item) => item.uci === move.uci)) {
    return;
  }
  existing.push(move);
  book.positions[key] = existing;
}

export async function lookupBookMoves(fen: string): Promise<BookMove[]> {
  await ensureLoaded();
  return book.positions[fenKey(fen)] ?? [];
}

export async function lookupBookMove(
  fen: string,
  uci: string,
): Promise<BookMove | undefined> {
  const moves = await lookupBookMoves(fen);
  return moves.find((move) => move.uci === uci);
}

export async function isBookMove(fen: string, uci: string): Promise<boolean> {
  return Boolean(await lookupBookMove(fen, uci));
}

export function slugifyOpening(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "opening";
}

function uniqueSlug(name: string, used: Set<string>): string {
  const base = slugifyOpening(name);
  let slug = base;
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function describeOpening(
  name: string,
  eco: string | undefined,
  lineCount: number,
  preview: string,
): string {
  const lines = lineCount === 1 ? "1 book line" : `${lineCount} book lines`;
  if (eco) {
    return `${eco}. ${lines} from your repertoire${preview ? `: ${preview}` : "."}`;
  }
  return `Train ${name} from the book — ${lines}${preview ? `. ${preview}` : "."}`;
}

function fenForOpening(openingName: string): string {
  const chess = new Chess();
  for (let ply = 0; ply < 10; ply += 1) {
    const options = book.positions[fenKey(chess.fen())] ?? [];
    const hit = options.find((move) => move.openingName === openingName);
    if (!hit) {
      break;
    }
    try {
      chess.move({
        from: hit.from as Square,
        to: hit.to as Square,
        ...(hit.promotion ? { promotion: hit.promotion as PieceSymbol } : {}),
      });
    } catch {
      break;
    }
  }
  return chess.fen();
}

function coursesFromBook(): OpeningCourse[] {
  const grouped = new Map<string, BookSource[]>();
  for (const source of book.sources) {
    const list = grouped.get(source.openingName) ?? [];
    list.push(source);
    grouped.set(source.openingName, list);
  }
  const used = new Set<string>();
  return [...grouped.entries()]
    .map(([name, sources]) => {
      const lines: OpeningLine[] = sources.map((source) => ({
        id: source.id,
        preview: source.preview,
        plyCount: source.plyCount,
      }));
      const eco = sources.find((source) => source.eco)?.eco;
      const preview = sources[0]?.preview ?? "";
      const course: OpeningCourse = {
        slug: uniqueSlug(name, used),
        name,
        description: describeOpening(name, eco, lines.length, preview),
        preview,
        fen: fenForOpening(name),
        lineCount: lines.length,
        lines,
      };
      if (eco) {
        course.eco = eco;
      }
      return course;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listOpenings(): Promise<OpeningCourse[]> {
  await ensureLoaded();
  return coursesFromBook();
}

export async function getOpening(slug: string): Promise<OpeningCourse> {
  await ensureLoaded();
  const course = coursesFromBook().find((item) => item.slug === slug);
  if (!course) {
    throw httpError("Opening not found", 404);
  }
  return course;
}

export async function listBookSources(): Promise<BookSource[]> {
  await ensureLoaded();
  return [...book.sources].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function importBookPgn(pgn: string): Promise<{
  games: number;
  positions: number;
  sources: BookSource[];
}> {
  await ensureLoaded();
  const games = splitPgnGames(pgn);
  if (games.length === 0) {
    throw httpError("Paste or upload a PGN", 400);
  }

  const addedSources: BookSource[] = [];
  let newPositions = 0;

  for (const gameText of games) {
    const chess = new Chess();
    try {
      chess.loadPgn(gameText);
    } catch {
      continue;
    }
    const verbose = chess.history({ verbose: true }).slice(0, MAX_BOOK_PLIES);
    if (verbose.length === 0) {
      continue;
    }
    const openingName = openingNameFromHeaders(chess);
    const eco = headerOf(chess, "ECO") || undefined;
    const replay = new Chess();
    for (const move of verbose) {
      const fenBefore = replay.fen();
      const beforeCount = (book.positions[fenKey(fenBefore)] ?? []).length;
      const played: BookMove = {
        uci: toUci(move.from, move.to, move.promotion),
        san: move.san,
        from: move.from,
        to: move.to,
        openingName,
      };
      if (move.promotion) {
        played.promotion = move.promotion;
      }
      addMove(fenBefore, played);
      if ((book.positions[fenKey(fenBefore)] ?? []).length > beforeCount) {
        newPositions += 1;
      }
      replay.move({
        from: move.from as Square,
        to: move.to as Square,
        ...(move.promotion
          ? { promotion: move.promotion as PieceSymbol }
          : {}),
      });
    }
    const source: BookSource = {
      id: randomUUID(),
      openingName,
      preview: previewSan(verbose),
      plyCount: verbose.length,
      uploadedAt: new Date().toISOString(),
    };
    if (eco) {
      source.eco = eco;
    }
    book.sources.push(source);
    addedSources.push(source);
  }

  if (addedSources.length === 0) {
    throw httpError("Could not parse any games from that PGN", 400);
  }
  await persist();
  return {
    games: addedSources.length,
    positions: newPositions,
    sources: addedSources,
  };
}

export async function tryTrainerMove(input: {
  fen: string;
  from: string;
  to: string;
  promotion?: string;
  preferredOpening?: string;
}): Promise<TrainerTryResult> {
  await ensureLoaded();
  const chess = new Chess(input.fen);
  let played;
  try {
    played = chess.move({
      from: input.from as Square,
      to: input.to as Square,
      ...(input.promotion
        ? { promotion: input.promotion as PieceSymbol }
        : {}),
    });
  } catch {
    throw httpError("Illegal move", 400);
  }

  const uci = toUci(played.from, played.to, played.promotion);
  const options = book.positions[fenKey(input.fen)] ?? [];
  if (options.length === 0) {
    return {
      status: "out_of_book",
      message: "This position is not in the book.",
    };
  }

  const hit = options.find((move) => move.uci === uci);
  if (hit) {
    const nextFen = chess.fen();
    const nextOptions = book.positions[fenKey(nextFen)] ?? [];
    const candidates = input.preferredOpening
      ? nextOptions.filter((move) => move.openingName === input.preferredOpening)
      : nextOptions;
    const reply = candidates[0];
    if (reply) {
      const after = new Chess(nextFen);
      after.move({
        from: reply.from as Square,
        to: reply.to as Square,
        ...(reply.promotion
          ? { promotion: reply.promotion as PieceSymbol }
          : {}),
      });
      const replyFen = after.fen();
      const afterOptions = book.positions[fenKey(replyFen)] ?? [];
      const stillInBook = input.preferredOpening
        ? afterOptions.some((move) => move.openingName === input.preferredOpening)
        : afterOptions.length > 0;
      return {
        status: "book",
        openingName: hit.openingName,
        message: stillInBook
          ? `Book: ${hit.openingName}. Reply ${reply.san}.`
          : `End of book for ${hit.openingName}.`,
        nextFen,
        reply,
        replyFen,
        lineComplete: !stillInBook,
      };
    }
    return {
      status: "book",
      openingName: hit.openingName,
      message: `End of book for ${hit.openingName}.`,
      nextFen,
      lineComplete: true,
    };
  }

  const preferred = input.preferredOpening
    ? options.find((move) => move.openingName === input.preferredOpening)
    : undefined;
  const suggestion = preferred ?? options[0];
  return {
    status: "wrong",
    message: suggestion
      ? `Not book. A correct continuation is ${suggestion.san} (${suggestion.openingName}).`
      : "Not book.",
    suggestion,
  };
}
