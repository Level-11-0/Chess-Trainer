import { Chess, type PieceSymbol, type Square } from "chess.js";
import type { BookMove, BookSource, OpeningCourse, OpeningLine, TrainerTryResult } from "./types";

export type StoredBook = {
  positions: Record<string, BookMove[]>;
  sources: BookSource[];
};

export function toUci(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion ?? ""}`;
}

export function fenKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
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

function fenForOpening(book: StoredBook, openingName: string): string {
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

export function coursesFromStoredBook(book: StoredBook): OpeningCourse[] {
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
        fen: fenForOpening(book, name),
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

export function evaluateTrainerMove(
  book: StoredBook,
  input: {
    fen: string;
    from: string;
    to: string;
    promotion?: string;
    preferredOpening?: string;
  },
): TrainerTryResult {
  let chess: Chess;
  try {
    chess = new Chess(input.fen);
  } catch {
    throw new Error("Invalid position");
  }

  let played;
  try {
    played = chess.move({
      from: input.from as Square,
      to: input.to as Square,
      ...(input.promotion ? { promotion: input.promotion as PieceSymbol } : {}),
    });
  } catch {
    throw new Error("Illegal move");
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
