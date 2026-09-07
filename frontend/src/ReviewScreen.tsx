import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Chessboard } from "react-chessboard";
import {
  REVIEW_API_MESSAGE,
  createReview,
  getReview,
  listReviews,
  usesOfflineBook,
} from "./api";
import { AnnotatedSquare } from "./AnnotatedSquare";
import { EvalBar } from "./EvalBar";
import {
  annotationGlyph,
  annotationLabel,
  evalLabel,
  formatSan,
} from "./glyphs";
import { useBoardWidth } from "./useBoardWidth";
import type { GameReview, PublicUser, ReviewListItem, ReviewedMove } from "./types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type SquareRenderProps = {
  children?: ReactNode;
  square: string;
  squareColor: "white" | "black";
  style?: CSSProperties;
};

function pairedMoves(moves: ReviewedMove[]) {
  const rows: {
    number: number;
    white?: ReviewedMove;
    black?: ReviewedMove;
  }[] = [];
  for (const move of moves) {
    if (move.color === "w") {
      rows.push({ number: rows.length + 1, white: move });
    } else {
      const last = rows[rows.length - 1];
      if (last && !last.black) {
        last.black = move;
      } else {
        rows.push({ number: rows.length + 1, black: move });
      }
    }
  }
  return rows;
}

function readPgnFile(
  event: ChangeEvent<HTMLInputElement>,
  onText: (text: string) => void,
) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onText(String(reader.result ?? ""));
  reader.readAsText(file);
}

export function ReviewScreen({
  user,
  initialPgn,
  onNeedAuth,
  onSaveStudy,
}: {
  user: PublicUser | null;
  initialPgn?: string;
  onNeedAuth: () => void;
  onSaveStudy: (title: string, pgn: string) => Promise<void>;
}) {
  const [pgn, setPgn] = useState(initialPgn ?? "");
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [review, setReview] = useState<GameReview | null>(null);
  const [ply, setPly] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studyTitle, setStudyTitle] = useState("");
  const { ref, width } = useBoardWidth(Boolean(review));
  const autoStarted = useRef(false);

  const currentMove = ply > 0 ? review?.moves[ply - 1] : undefined;
  const fen = currentMove?.fen ?? review?.startingFen ?? START_FEN;
  const evaluation = currentMove?.evaluation ?? null;

  const CustomSquare = useMemo(() => {
    const dest = currentMove?.to;
    const annotation = currentMove?.annotation ?? null;
    return forwardRef<HTMLDivElement, SquareRenderProps>(function CustomSquare(
      props,
      ref,
    ) {
      return (
        <AnnotatedSquare
          ref={ref}
          square={props.square}
          squareColor={props.squareColor}
          style={props.style}
          annotation={props.square === dest ? annotation : null}
        >
          {props.children}
        </AnnotatedSquare>
      );
    });
  }, [currentMove?.annotation, currentMove?.to]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (currentMove) {
      styles[currentMove.from] = { backgroundColor: "rgba(255, 207, 64, 0.55)" };
      styles[currentMove.to] = { backgroundColor: "rgba(255, 207, 64, 0.55)" };
    }
    return styles;
  }, [currentMove]);

  useEffect(() => {
    if (autoStarted.current || !initialPgn || initialPgn.trim().length < 10) {
      return;
    }
    autoStarted.current = true;
    setBusy(true);
    setError(null);
    void createReview(initialPgn)
      .then((next) => {
        setReview(next);
        setPly(0);
        setStudyTitle(`${next.white} vs ${next.black}`);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not start review");
      })
      .finally(() => setBusy(false));
  }, [initialPgn]);

  useEffect(() => {
    if (!user) {
      setReviews([]);
      return;
    }
    void listReviews()
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [user]);

  useEffect(() => {
    if (!review || review.status !== "analyzing") {
      return;
    }
    const timer = window.setInterval(() => {
      void getReview(review.id)
        .then((next) => {
          setReview(next);
          setReviews((current) =>
            current.map((item) =>
              item.id === next.id
                ? {
                    ...item,
                    status: next.status,
                    progress: next.progress,
                    summary: next.summary,
                  }
                : item,
            ),
          );
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Could not load review");
        });
    }, 900);
    return () => window.clearInterval(timer);
  }, [review]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!review) {
        return;
      }
      if (event.key === "ArrowRight") {
        setPly((value) => Math.min(review.moves.length, value + 1));
      }
      if (event.key === "ArrowLeft") {
        setPly((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [review]);

  const onUploadReview = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await createReview(pgn);
      setReview(next);
      setPly(0);
      setStudyTitle(`${next.white} vs ${next.black}`);
      if (user) {
        setReviews((current) => [
          {
            id: next.id,
            white: next.white,
            black: next.black,
            result: next.result,
            event: next.event,
            date: next.date,
            status: next.status,
            progress: next.progress,
            summary: next.summary,
            createdAt: next.createdAt,
          },
          ...current,
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start review");
    } finally {
      setBusy(false);
    }
  }, [pgn, user]);

  const openReview = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await getReview(id);
      setReview(next);
      setPly(0);
      setStudyTitle(`${next.white} vs ${next.black}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open review");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!review) {
    return (
      <section className="setup-card wide">
        <h2>Upload a PGN</h2>
        <p className="muted">
          Stockfish reviews the game and marks inaccuracies (?!), mistakes (?),
          and blunders (??). Book moves show the opening name.
          {!user
            ? " Guest analysis stays in this session and is not saved to an account."
            : ""}
        </p>
        {usesOfflineBook() ? (
          <p className="error">{REVIEW_API_MESSAGE}</p>
        ) : null}
        <label className="field">
          <span>PGN file</span>
          <input
            type="file"
            accept=".pgn,text/plain"
            onChange={(event) => readPgnFile(event, setPgn)}
          />
        </label>
        <label className="field">
          <span>Or paste PGN</span>
          <textarea
            value={pgn}
            onChange={(event) => setPgn(event.target.value)}
            rows={10}
            placeholder='[Event "Rated game"]...'
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button
          type="button"
          className="primary"
          onClick={() => void onUploadReview()}
          disabled={busy || usesOfflineBook() || pgn.trim().length < 10}
        >
          {busy ? "Uploading…" : "Review game"}
        </button>
        {reviews.length > 0 ? (
          <div className="review-list">
            <h3>Your reviews</h3>
            {reviews.map((item) => (
              <button
                key={item.id}
                type="button"
                className="review-row"
                onClick={() => void openReview(item.id)}
              >
                <strong>
                  {item.white} vs {item.black}
                </strong>
                <span>
                  {item.result} ·{" "}
                  {item.status === "analyzing"
                    ? `${item.progress.analyzed}/${item.progress.total}`
                    : `${item.summary.blunders} blunders, ${item.summary.mistakes} mistakes`}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <main className="play-layout">
      <section className="board-column">
        <div className="eval-and-board">
          <EvalBar evaluation={evaluation} height={width} />
          <div ref={ref} className="board-wrap">
            <Chessboard
              position={fen}
              arePiecesDraggable={false}
              boardWidth={width}
              animationDuration={180}
              customSquare={CustomSquare}
              customSquareStyles={squareStyles}
              customBoardStyle={{
                borderRadius: "8px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
              }}
              customDarkSquareStyle={{ backgroundColor: "#739552" }}
              customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
            />
          </div>
        </div>
        <div className="nav-row">
          <button type="button" className="ghost compact" onClick={() => setPly(0)}>
            Start
          </button>
          <button
            type="button"
            className="ghost compact"
            onClick={() => setPly((value) => Math.max(0, value - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="ghost compact"
            onClick={() =>
              setPly((value) => Math.min(review.moves.length, value + 1))
            }
          >
            Next
          </button>
          <button
            type="button"
            className="ghost compact"
            onClick={() => setPly(review.moves.length)}
          >
            End
          </button>
        </div>
        <p className={`status ${review.status === "analyzing" ? "thinking" : ""}`}>
          {review.status === "analyzing"
            ? `Analyzing ${review.progress.analyzed}/${review.progress.total}…`
            : review.status === "error"
              ? review.error ?? "Analysis failed"
              : currentMove
                ? `${currentMove.san}${currentMove.annotation ? ` ${annotationGlyph(currentMove.annotation)} ${annotationLabel(currentMove.annotation)}` : ""}${currentMove.openingName ? ` · ${currentMove.openingName}` : ""} · eval ${evalLabel(evaluation)}`
                : "Starting position"}
        </p>
        {error ? <p className="error">{error}</p> : null}
      </section>
      <aside className="sidebar">
        <div className="players">
          <div>
            <strong>{review.white}</strong>
            <span>White</span>
          </div>
          <div>
            <strong>{review.black}</strong>
            <span>Black · {review.result}</span>
          </div>
        </div>
        <div className="summary-pills">
          <span>{review.summary.inaccuracies} ?!</span>
          <span>{review.summary.mistakes} ?</span>
          <span>{review.summary.blunders} ??</span>
        </div>
        {review.summary.worst.length > 0 ? (
          <div className="worst">
            <h2>Worst moves</h2>
            <ul>
              {review.summary.worst.map((item) => (
                <li key={`${item.ply}-${item.san}`}>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setPly(item.ply)}
                  >
                    {item.color === "w" ? "W" : "B"} {item.san}
                    {item.kind === "blunder"
                      ? "??"
                      : item.kind === "mistake"
                        ? "?"
                        : "?!"}{" "}
                    −{(item.lossCp / 100).toFixed(1)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="moves">
          <h2>Moves</h2>
          <ol>
            {pairedMoves(review.moves).map((row) => (
              <li key={row.number}>
                <span className="ply">{row.number}.</span>
                {(["white", "black"] as const).map((side) => {
                  const move = row[side];
                  if (!move) {
                    return <span key={side} />;
                  }
                  return (
                    <button
                      key={side}
                      type="button"
                      className={`san ${ply === move.ply ? "active" : ""} ${move.annotation?.kind ?? ""}`}
                      title={
                        [
                          move.openingName,
                          move.annotation
                            ? `${annotationLabel(move.annotation)} (−${(move.lossCp / 100).toFixed(1)})`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                      onClick={() => setPly(move.ply)}
                    >
                      {formatSan(move.san, move.annotation)}
                    </button>
                  );
                })}
              </li>
            ))}
          </ol>
        </div>
        <div className="legend">
          <span>📖 book</span>
          <span>?! inaccuracy</span>
          <span>? mistake</span>
          <span>?? blunder</span>
        </div>
        <label className="field">
          <span>Save as study</span>
          <input
            value={studyTitle}
            onChange={(event) => setStudyTitle(event.target.value)}
            placeholder="Study title"
            maxLength={80}
          />
        </label>
        {user ? (
          <button
            type="button"
            className="primary"
            disabled={studyTitle.trim().length < 1}
            onClick={() => void onSaveStudy(studyTitle.trim(), review.pgn)}
          >
            Save study
          </button>
        ) : (
          <button type="button" className="ghost" onClick={onNeedAuth}>
            Sign up to save this study
          </button>
        )}
        <div className="actions">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setReview(null);
              setPly(0);
            }}
          >
            Back to uploads
          </button>
        </div>
      </aside>
    </main>
  );
}
