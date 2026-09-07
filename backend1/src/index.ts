import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { warmupEngine } from "./engine.js";
import { createGame, getGame, playMove, resignGame } from "./game.js";
import type { Difficulty, PlayerColor } from "./types.js";

const PORT = Number(process.env.PORT ?? 3001);
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, engine: "stockfish" });
});

app.post("/api/games", async (req, res, next) => {
  try {
    const playerColor = req.body?.playerColor as
      | PlayerColor
      | "random"
      | undefined;
    const difficulty = req.body?.difficulty as Difficulty | undefined;
    const game = await createGame({ playerColor, difficulty });
    res.status(201).json(game);
  } catch (error) {
    next(error);
  }
});

app.get("/api/games/:id", (req, res, next) => {
  try {
    res.json(getGame(req.params.id as string));
  } catch (error) {
    next(error);
  }
});

app.post("/api/games/:id/moves", async (req, res, next) => {
  try {
    const { from, to, promotion } = req.body ?? {};
    if (typeof from !== "string" || typeof to !== "string") {
      res.status(400).json({ error: "from and to are required" });
      return;
    }
    const game = await playMove(
      req.params.id as string,
      from,
      to,
      typeof promotion === "string" ? promotion : undefined,
    );
    res.json(game);
  } catch (error) {
    next(error);
  }
});

app.post("/api/games/:id/resign", (req, res, next) => {
  try {
    res.json(resignGame(req.params.id as string));
  } catch (error) {
    next(error);
  }
});

app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;
    const message = error instanceof Error ? error.message : "Server error";
    if (status >= 500) {
      console.error(error);
    }
    res.status(status).json({ error: message });
  },
);

app.listen(PORT, () => {
  console.log(`Chess API listening on http://localhost:${PORT}`);
  warmupEngine()
    .then(() => console.log("Stockfish engine ready"))
    .catch((error) => console.error("Failed to start Stockfish", error));
});
