import { Chess } from "chess.js";

const GLYPH: Record<string, string> = {
  wP: "♙",
  wN: "♘",
  wB: "♗",
  wR: "♖",
  wQ: "♕",
  wK: "♔",
  bP: "♟",
  bN: "♞",
  bB: "♝",
  bR: "♜",
  bQ: "♛",
  bK: "♚",
};

type MiniBoardProps = {
  fen: string;
};

export function MiniBoard({ fen }: MiniBoardProps) {
  let rows;
  try {
    rows = new Chess(fen).board();
  } catch {
    rows = new Chess().board();
  }
  return (
    <div className="mini-board" aria-hidden="true">
      {rows.map((row, rank) =>
        row.map((square, file) => {
          const light = (rank + file) % 2 === 0;
          const key = square
            ? `${square.color}${square.type.toUpperCase()}`
            : "";
          return (
            <span
              key={`${rank}-${file}`}
              className={`mini-sq ${light ? "light" : "dark"}`}
            >
              {key ? GLYPH[key] : ""}
            </span>
          );
        }),
      )}
    </div>
  );
}
