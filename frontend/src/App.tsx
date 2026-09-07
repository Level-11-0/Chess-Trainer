import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { chooseBotMove } from "./engine";
import {
  applyMove,
  botColor,
  createLocalGame,
  serialize,
  type LocalGame,
} from "./game";
import type { Difficulty, Evaluation, GameState, PlayerColor } from "./types";
import "./App.css";

const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: "beginner", label: "Beginner", blurb: "Mostly random" },
  { id: "easy", label: "Easy", blurb: "1 ply" },
  { id: "medium", label: "Medium", blurb: "2 ply" },
  { id: "hard", label: "Hard", blurb: "3 ply" },
  { id: "master", label: "Master", blurb: "3 ply, sharper" },
];

const PIECE_GLYPH: Record<"w" | "b", Record<string, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

function evalBarPercent(evaluation: Evaluation | null): number {
  if (!evaluation) {
    return 50;
  }
  if (evaluation.type === "mate") {
    if (evaluation.value === 0) {
      return 50;
    }
    return evaluation.value > 0 ? 97 : 3;
  }
  const capped = Math.max(-900, Math.min(900, evaluation.value));
  return 50 + (capped / 900) * 47;
}

function evalLabel(evaluation: Evaluation | null): string {
  if (!evaluation) {
    return "0.0";
  }
  if (evaluation.type === "mate") {
    return evaluation.value > 0
      ? `M${evaluation.value}`
      : `-M${Math.abs(evaluation.value)}`;
  }
  const pawns = evaluation.value / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

function statusText(game: GameState, thinking: boolean): string {
  if (thinking) {
    return "Bot is thinking…";
  }
  if (game.status === "checkmate") {
    return game.winner === game.playerColor
      ? "Checkmate — you win"
      : "Checkmate — bot wins";
  }
  if (game.status === "stalemate") {
    return "Stalemate";
  }
  if (game.status === "draw") {
    return "Draw";
  }
  if (game.status === "resigned") {
    return "You resigned";
  }
  if (game.inCheck) {
    return "Check";
  }
  return game.turn === (game.playerColor === "white" ? "w" : "b")
    ? "Your move"
    : "Bot to move";
}

function pairedMoves(history: GameState["history"]) {
  const rows: { number: number; white?: string; black?: string }[] = [];
  for (let i = 0; i < history.length; i += 1) {
    const move = history[i];
    if (!move) {
      continue;
    }
    if (move.color === "w") {
      rows.push({ number: rows.length + 1, white: move.san });
    } else {
      const last = rows[rows.length - 1];
      if (last && !last.black) {
        last.black = move.san;
      } else {
        rows.push({ number: rows.length + 1, black: move.san });
      }
    }
  }
  return rows;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function App() {
  const sessionRef = useRef<LocalGame | null>(null);
  const playTokenRef = useRef(0);
  const [game, setGame] = useState<GameState | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [colorChoice, setColorChoice] = useState<PlayerColor | "random">(
    "white",
  );
  const [selected, setSelected] = useState<Square | null>(null);
  const [busy, setBusy] = useState(false);
  const [boardWidth, setBoardWidth] = useState(560);
  const boardWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = boardWrapRef.current;
    if (!node) {
      return;
    }
    const update = () => {
      setBoardWidth(Math.max(280, Math.min(node.clientWidth, 640)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [game]);

  const runBotMove = useCallback(async (token: number) => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    if (
      session.chess.isGameOver() ||
      session.resigned ||
      session.chess.turn() !== botColor(session)
    ) {
      setBusy(false);
      setGame(serialize(session));
      return;
    }

    setBusy(true);
    setGame(serialize(session, true));
    await wait(session.difficulty === "beginner" ? 180 : 280);
    if (token !== playTokenRef.current) {
      return;
    }

    const { move, evaluation } = chooseBotMove(
      session.chess.fen(),
      session.difficulty,
    );
    if (token !== playTokenRef.current) {
      return;
    }

    session.evaluation = evaluation;
    if (move) {
      applyMove(session, move.from, move.to, move.promotion);
    }
    setGame(serialize(session));
    setBusy(false);
  }, []);

  const startGame = useCallback(async () => {
    const token = playTokenRef.current + 1;
    playTokenRef.current = token;
    setSelected(null);
    const session = createLocalGame(colorChoice, difficulty);
    sessionRef.current = session;
    setGame(serialize(session));
    setBusy(false);
    if (session.playerColor === "black") {
      await runBotMove(token);
    }
  }, [colorChoice, difficulty, runBotMove]);

  const submitMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      const session = sessionRef.current;
      const token = playTokenRef.current;
      if (!session || busy || serialize(session).status !== "playing") {
        return false;
      }
      if (session.chess.turn() !== (session.playerColor === "white" ? "w" : "b")) {
        return false;
      }
      if (!applyMove(session, from, to, promotion)) {
        return false;
      }

      setSelected(null);
      setGame(serialize(session, true));
      await runBotMove(token);
      return true;
    },
    [busy, runBotMove],
  );

  const onResign = useCallback(() => {
    const session = sessionRef.current;
    if (!session || serialize(session).status !== "playing") {
      return;
    }
    playTokenRef.current += 1;
    session.resigned = session.playerColor;
    setBusy(false);
    setGame(serialize(session));
  }, []);

  const legalTargets = useMemo(() => {
    if (!game || !selected) {
      return new Set<string>();
    }
    const chess = new Chess(game.fen);
    return new Set(
      chess.moves({ square: selected, verbose: true }).map((move) => move.to),
    );
  }, [game, selected]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (game?.lastMove) {
      styles[game.lastMove.from] = { backgroundColor: "rgba(255, 207, 64, 0.55)" };
      styles[game.lastMove.to] = { backgroundColor: "rgba(255, 207, 64, 0.55)" };
    }
    if (selected) {
      styles[selected] = { backgroundColor: "rgba(32, 136, 255, 0.45)" };
    }
    for (const square of legalTargets) {
      styles[square] = {
        background:
          "radial-gradient(circle, rgba(0,0,0,0.28) 22%, transparent 24%)",
      };
    }
    return styles;
  }, [game?.lastMove, legalTargets, selected]);

  const playerTurn = Boolean(
    game &&
      game.status === "playing" &&
      !busy &&
      game.turn === (game.playerColor === "white" ? "w" : "b"),
  );

  const onPieceDrop = (
    sourceSquare: string,
    targetSquare: string,
    piece: string,
  ) => {
    if (!game || !playerTurn) {
      return false;
    }
    const local = new Chess(game.fen);
    const needsPromotion = local
      .moves({ square: sourceSquare as Square, verbose: true })
      .some((move) => move.to === targetSquare && Boolean(move.promotion));
    const raw = piece[1]?.toLowerCase();
    const promotion = needsPromotion
      ? raw && raw !== "p"
        ? raw
        : "q"
      : undefined;
    try {
      local.move({
        from: sourceSquare,
        to: targetSquare,
        ...(promotion ? { promotion } : {}),
      });
    } catch {
      return false;
    }
    void submitMove(sourceSquare, targetSquare, promotion);
    return true;
  };

  const onSquareClick = (square: string) => {
    if (!game || !playerTurn) {
      return;
    }
    if (selected && legalTargets.has(square)) {
      const chess = new Chess(game.fen);
      const options = chess
        .moves({ square: selected, verbose: true })
        .filter((move) => move.to === square);
      const needsPromotion = options.some((move) => move.promotion);
      void submitMove(selected, square, needsPromotion ? "q" : undefined);
      return;
    }
    const chess = new Chess(game.fen);
    const piece = chess.get(square as Square);
    const playerCode = game.playerColor === "white" ? "w" : "b";
    if (piece && piece.color === playerCode) {
      setSelected(square as Square);
    } else {
      setSelected(null);
    }
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Chess Training</p>
          <h1>Play vs Bot</h1>
        </div>
        <p className="engine-tag">chess.js + local engine</p>
      </header>

      {!game ? (
        <section className="setup-card">
          <h2>New game</h2>
          <p className="muted">
            Choose a color and strength, then play a full game in the browser.
          </p>

          <div className="field">
            <span>Your color</span>
            <div className="choice-row">
              {(
                [
                  ["white", "White"],
                  ["black", "Black"],
                  ["random", "Random"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={colorChoice === value ? "choice active" : "choice"}
                  onClick={() => setColorChoice(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Difficulty</span>
            <div className="choice-row wrap">
              {DIFFICULTIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    difficulty === item.id ? "choice active" : "choice"
                  }
                  onClick={() => setDifficulty(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="primary"
            onClick={() => void startGame()}
          >
            Start game
          </button>
        </section>
      ) : (
        <main className="play-layout">
          <section className="board-column">
            <div className="eval-and-board">
              <div
                className="eval-bar"
                title={`Evaluation ${evalLabel(game.evaluation)}`}
              >
                <div
                  className="eval-white"
                  style={{ height: `${evalBarPercent(game.evaluation)}%` }}
                />
                <span className="eval-label">
                  {evalLabel(game.evaluation)}
                </span>
              </div>
              <div ref={boardWrapRef} className="board-wrap">
                <Chessboard
                  position={game.fen}
                  onPieceDrop={onPieceDrop}
                  onSquareClick={onSquareClick}
                  boardOrientation={game.playerColor}
                  boardWidth={boardWidth}
                  arePiecesDraggable={playerTurn}
                  animationDuration={200}
                  customSquareStyles={squareStyles}
                  customBoardStyle={{
                    borderRadius: "4px",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                  }}
                  customDarkSquareStyle={{ backgroundColor: "#739552" }}
                  customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
                  isDraggablePiece={({ piece }) =>
                    playerTurn &&
                    piece.startsWith(game.playerColor === "white" ? "w" : "b")
                  }
                />
              </div>
            </div>
            <p className={`status ${busy ? "thinking" : ""}`}>
              {statusText(game, busy)}
            </p>
          </section>

          <aside className="sidebar">
            <div className="players">
              <div>
                <strong>Bot</strong>
                <span>
                  {DIFFICULTIES.find((item) => item.id === game.difficulty)
                    ?.label ?? game.difficulty}
                </span>
                <div className="captured">
                  {(game.playerColor === "white"
                    ? game.captured.black
                    : game.captured.white
                  ).map((piece, index) => (
                    <span key={`opp-${piece}-${index}`}>
                      {
                        PIECE_GLYPH[game.playerColor === "white" ? "w" : "b"][
                          piece
                        ]
                      }
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <strong>You</strong>
                <span>{game.playerColor}</span>
                <div className="captured">
                  {(game.playerColor === "white"
                    ? game.captured.white
                    : game.captured.black
                  ).map((piece, index) => (
                    <span key={`you-${piece}-${index}`}>
                      {
                        PIECE_GLYPH[game.playerColor === "white" ? "b" : "w"][
                          piece
                        ]
                      }
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="moves">
              <h2>Moves</h2>
              <ol>
                {pairedMoves(game.history).map((row) => (
                  <li key={row.number}>
                    <span className="ply">{row.number}.</span>
                    <span>{row.white ?? ""}</span>
                    <span>{row.black ?? ""}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="actions">
              <button
                type="button"
                className="primary"
                onClick={() => void startGame()}
              >
                New game
              </button>
              <button
                type="button"
                className="ghost"
                onClick={onResign}
                disabled={busy || game.status !== "playing"}
              >
                Resign
              </button>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}
