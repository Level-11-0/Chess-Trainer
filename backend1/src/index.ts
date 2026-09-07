import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { warmupEngine } from "./engine.js";
import { getTrainerNote, saveTrainerNote } from "./notes.js";
import {
  getOpening,
  importBookPgn,
  listBookSources,
  listOpenings,
  lookupBookMoves,
  tryTrainerMove,
} from "./openingBook.js";
import {
  getAllProgress,
  getOpeningProgress,
  upsertOpeningProgress,
} from "./progress.js";
import { createReview, getReview, listReviews } from "./reviews.js";
import {
  createStudy,
  deleteStudy,
  getStudy,
  listStudies,
} from "./studies.js";
import type { PublicUser } from "./types.js";
import {
  clearSessionCookie,
  destroySession,
  loginUser,
  parseCookies,
  registerUser,
  SESSION_COOKIE,
  sessionCookie,
  userFromToken,
} from "./users.js";

const PORT = Number(process.env.PORT ?? 3001);
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "400kb" }));

function tokenFromRequest(req: Request): string | undefined {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE];
}

async function optionalUser(req: Request): Promise<PublicUser | null> {
  return userFromToken(tokenFromRequest(req));
}

async function requireUser(
  req: Request,
  res: Response,
): Promise<PublicUser | null> {
  const user = await userFromToken(tokenFromRequest(req));
  if (!user) {
    res.status(401).json({ error: "Sign in required" });
    return null;
  }
  return user;
}

async function requireAdmin(
  req: Request,
  res: Response,
): Promise<PublicUser | null> {
  const user = await requireUser(req, res);
  if (!user) {
    return null;
  }
  if (!user.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return null;
  }
  return user;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, engine: "stockfish" });
});

function goneGames(_req: Request, res: Response): void {
  res.status(410).json({
    error: "Play vs bot was removed. Use the trainer instead.",
  });
}

app.all("/api/games", goneGames);
app.all("/api/games/*path", goneGames);

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? "");
    const password = String(req.body?.password ?? "");
    const { user, token } = await registerUser(username, password);
    res.setHeader("Set-Cookie", sessionCookie(token));
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? "");
    const password = String(req.body?.password ?? "");
    const { user, token } = await loginUser(username, password);
    res.setHeader("Set-Cookie", sessionCookie(token));
    res.json(user);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  destroySession(tokenFromRequest(req));
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    const user = await userFromToken(tokenFromRequest(req));
    if (!user) {
      res.status(401).json({ error: "Signed out" });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reviews", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    res.json(await listReviews(user.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/reviews", async (req, res, next) => {
  try {
    const user = await optionalUser(req);
    const pgn = String(req.body?.pgn ?? "");
    const review = await createReview(user?.id ?? null, pgn);
    res.status(202).json(review);
  } catch (error) {
    next(error);
  }
});

app.get("/api/reviews/:id", async (req, res, next) => {
  try {
    const user = await optionalUser(req);
    res.json(await getReview(req.params.id as string, user?.id ?? null));
  } catch (error) {
    next(error);
  }
});

app.get("/api/book/openings", async (_req, res, next) => {
  try {
    res.json(await listOpenings());
  } catch (error) {
    next(error);
  }
});

app.get("/api/book/openings/:slug", async (req, res, next) => {
  try {
    res.json(await getOpening(req.params.slug as string));
  } catch (error) {
    next(error);
  }
});

app.get("/api/book/lookup", async (req, res, next) => {
  try {
    const fen = String(req.query.fen ?? "");
    if (!fen) {
      res.status(400).json({ error: "fen is required" });
      return;
    }
    res.json({ fen, moves: await lookupBookMoves(fen) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/book/sources", async (req, res, next) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) {
      return;
    }
    res.json(await listBookSources());
  } catch (error) {
    next(error);
  }
});

app.post("/api/book/pgns", async (req, res, next) => {
  try {
    const user = await requireAdmin(req, res);
    if (!user) {
      return;
    }
    const result = await importBookPgn(String(req.body?.pgn ?? ""));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/studies", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    res.json(await listStudies(user.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/studies", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    const study = await createStudy(
      user.id,
      String(req.body?.title ?? ""),
      String(req.body?.pgn ?? ""),
    );
    res.status(201).json(study);
  } catch (error) {
    next(error);
  }
});

app.get("/api/studies/:id", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    res.json(await getStudy(req.params.id as string, user.id));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/studies/:id", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    await deleteStudy(req.params.id as string, user.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/progress", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    res.json(await getAllProgress(user.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/progress/:openingId", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    res.json(
      await getOpeningProgress(user.id, req.params.openingId as string),
    );
  } catch (error) {
    next(error);
  }
});

app.put("/api/progress/:openingId", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    const learnedLineIds = Array.isArray(req.body?.learnedLineIds)
      ? req.body.learnedLineIds.filter(
          (id: unknown): id is string => typeof id === "string",
        )
      : undefined;
    const notes =
      typeof req.body?.notes === "string" ? req.body.notes : undefined;
    res.json(
      await upsertOpeningProgress(user.id, req.params.openingId as string, {
        learnedLineIds,
        notes,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/trainer/try", async (req, res, next) => {
  try {
    const fen = String(req.body?.fen ?? "");
    const from = String(req.body?.from ?? "");
    const to = String(req.body?.to ?? "");
    if (!fen || !from || !to) {
      res.status(400).json({ error: "fen, from, and to are required" });
      return;
    }
    res.json(
      await tryTrainerMove({
        fen,
        from,
        to,
        promotion:
          typeof req.body?.promotion === "string"
            ? req.body.promotion
            : undefined,
        preferredOpening:
          typeof req.body?.preferredOpening === "string"
            ? req.body.preferredOpening
            : undefined,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/trainer/notes", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    const openingName =
      typeof req.query.opening === "string" ? req.query.opening : undefined;
    res.json({
      openingName: openingName ?? "",
      text: await getTrainerNote(user.id, openingName),
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/trainer/notes", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) {
      return;
    }
    const openingName =
      typeof req.body?.openingName === "string" ? req.body.openingName : "";
    const text = String(req.body?.text ?? "");
    const saved = await saveTrainerNote(user.id, openingName, text);
    res.json({ openingName, text: saved });
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
