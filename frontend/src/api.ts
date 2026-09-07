import {
  offlineGetOpening,
  offlineListBookSources,
  offlineListOpenings,
  offlineTryTrainerMove,
} from "./offlineBook";
import type {
  BookSource,
  GameReview,
  OpeningCourse,
  OpeningProgress,
  PublicUser,
  ReviewListItem,
  Study,
  StudyListItem,
  TrainerTryResult,
} from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

export const API_DOWN_MESSAGE =
  "API is not running (start backend1 on port 3001)";

export const REVIEW_API_MESSAGE =
  "PGN review needs the Stockfish API. Run the backend locally or set VITE_API_URL.";

export const AUTH_API_MESSAGE = API_DOWN_MESSAGE;

function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL;
  return typeof raw === "string" ? raw.replace(/\/$/, "") : "";
}

export function usesRemoteApi(): boolean {
  return Boolean(apiOrigin()) || import.meta.env.DEV;
}

export function usesOfflineBook(): boolean {
  return !usesRemoteApi();
}

function apiUrl(path: string): string {
  return `${apiOrigin()}${path}`;
}

function looksLikeApiDown(status: number, text: string): boolean {
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }
  const snippet = text.toLowerCase();
  return (
    snippet.includes("econnrefused") ||
    snippet.includes("http proxy error") ||
    (status >= 500 &&
      (!text.trim() ||
        snippet.includes("<!doctype") ||
        snippet.includes("<html")))
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const where = response.url || "API";
  if (looksLikeApiDown(response.status, text)) {
    throw new Error(API_DOWN_MESSAGE);
  }
  if (!text.trim()) {
    throw new Error(
      `Empty response from ${where} (${response.status} ${response.statusText || "no status"}). ${API_DOWN_MESSAGE}.`,
    );
  }
  let payload: T & { error?: string };
  try {
    payload = JSON.parse(text) as T & { error?: string };
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 140);
    throw new Error(
      `Expected JSON from ${where} (${response.status}): ${snippet}`,
    );
  }
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
  }).catch(() => {
    throw new Error(API_DOWN_MESSAGE);
  });
}

async function withBookFallback<T>(
  remote: () => Promise<T>,
  local: () => Promise<T>,
): Promise<T> {
  if (!usesRemoteApi()) {
    return local();
  }
  try {
    return await remote();
  } catch {
    return local();
  }
}

export async function fetchMe(): Promise<PublicUser | null> {
  if (!usesRemoteApi()) {
    return null;
  }
  const response = await request("/api/auth/me");
  if (response.status === 401) {
    return null;
  }
  return parseResponse<PublicUser>(response);
}

export async function register(
  username: string,
  password: string,
): Promise<PublicUser> {
  if (!usesRemoteApi()) {
    throw new Error(AUTH_API_MESSAGE);
  }
  const response = await request("/api/auth/register", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  return parseResponse<PublicUser>(response);
}

export async function login(
  username: string,
  password: string,
): Promise<PublicUser> {
  if (!usesRemoteApi()) {
    throw new Error(AUTH_API_MESSAGE);
  }
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  return parseResponse<PublicUser>(response);
}

export async function logout(): Promise<void> {
  if (!usesRemoteApi()) {
    return;
  }
  await request("/api/auth/logout", { method: "POST" });
}

export async function listReviews(): Promise<ReviewListItem[]> {
  if (!usesRemoteApi()) {
    return [];
  }
  const response = await request("/api/reviews");
  return parseResponse<ReviewListItem[]>(response);
}

export async function createReview(pgn: string): Promise<GameReview> {
  if (!usesRemoteApi()) {
    throw new Error(REVIEW_API_MESSAGE);
  }
  const response = await request("/api/reviews", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ pgn }),
  });
  return parseResponse<GameReview>(response);
}

export async function getReview(id: string): Promise<GameReview> {
  if (!usesRemoteApi()) {
    throw new Error(REVIEW_API_MESSAGE);
  }
  const response = await request(`/api/reviews/${id}`);
  return parseResponse<GameReview>(response);
}

export async function listOpenings(): Promise<OpeningCourse[]> {
  return withBookFallback(
    async () => {
      const response = await request("/api/book/openings");
      return parseResponse<OpeningCourse[]>(response);
    },
    offlineListOpenings,
  );
}

export async function getOpening(slug: string): Promise<OpeningCourse> {
  return withBookFallback(
    async () => {
      const response = await request(`/api/book/openings/${slug}`);
      return parseResponse<OpeningCourse>(response);
    },
    () => offlineGetOpening(slug),
  );
}

export async function listBookSources(): Promise<BookSource[]> {
  return withBookFallback(
    async () => {
      const response = await request("/api/book/sources");
      return parseResponse<BookSource[]>(response);
    },
    offlineListBookSources,
  );
}

export async function importBookPgn(pgn: string): Promise<{
  games: number;
  positions: number;
  sources: BookSource[];
}> {
  if (!usesRemoteApi()) {
    throw new Error(
      "Book import needs the API. Run the backend locally or set VITE_API_URL.",
    );
  }
  const response = await request("/api/book/pgns", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ pgn }),
  });
  return parseResponse(response);
}

export async function tryTrainerMove(input: {
  fen: string;
  from: string;
  to: string;
  promotion?: string;
  preferredOpening?: string;
}): Promise<TrainerTryResult> {
  return withBookFallback(
    async () => {
      const response = await request("/api/trainer/try", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(input),
      });
      return parseResponse<TrainerTryResult>(response);
    },
    () => offlineTryTrainerMove(input),
  );
}

export async function getTrainerNotes(openingName: string): Promise<string> {
  if (!usesRemoteApi()) {
    return "";
  }
  const params = new URLSearchParams();
  if (openingName) {
    params.set("opening", openingName);
  }
  const response = await request(`/api/trainer/notes?${params.toString()}`);
  const payload = await parseResponse<{ text: string }>(response);
  return payload.text;
}

export async function saveTrainerNotes(
  openingName: string,
  text: string,
): Promise<void> {
  if (!usesRemoteApi()) {
    return;
  }
  const response = await request("/api/trainer/notes", {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify({ openingName, text }),
  });
  await parseResponse(response);
}

export async function listStudies(): Promise<StudyListItem[]> {
  if (!usesRemoteApi()) {
    return [];
  }
  const response = await request("/api/studies");
  return parseResponse<StudyListItem[]>(response);
}

export async function createStudy(
  title: string,
  pgn: string,
): Promise<Study> {
  if (!usesRemoteApi()) {
    throw new Error(
      "Studies need the API. Run the backend locally or set VITE_API_URL.",
    );
  }
  const response = await request("/api/studies", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ title, pgn }),
  });
  return parseResponse<Study>(response);
}

export async function getStudy(id: string): Promise<Study> {
  if (!usesRemoteApi()) {
    throw new Error(
      "Studies need the API. Run the backend locally or set VITE_API_URL.",
    );
  }
  const response = await request(`/api/studies/${id}`);
  return parseResponse<Study>(response);
}

export async function deleteStudy(id: string): Promise<void> {
  if (!usesRemoteApi()) {
    return;
  }
  const response = await request(`/api/studies/${id}`, { method: "DELETE" });
  await parseResponse(response);
}

export async function getAllProgress(): Promise<
  Record<string, OpeningProgress>
> {
  if (!usesRemoteApi()) {
    return {};
  }
  const response = await request("/api/progress");
  return parseResponse<Record<string, OpeningProgress>>(response);
}

export async function getProgress(
  openingId: string,
): Promise<OpeningProgress> {
  if (!usesRemoteApi()) {
    return {
      learnedLineIds: [],
      notes: "",
      updatedAt: new Date().toISOString(),
    };
  }
  const response = await request(`/api/progress/${openingId}`);
  return parseResponse<OpeningProgress>(response);
}

export async function putProgress(
  openingId: string,
  patch: { learnedLineIds?: string[]; notes?: string },
): Promise<OpeningProgress> {
  if (!usesRemoteApi()) {
    return {
      learnedLineIds: patch.learnedLineIds ?? [],
      notes: patch.notes ?? "",
      updatedAt: new Date().toISOString(),
    };
  }
  const response = await request(`/api/progress/${openingId}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(patch),
  });
  return parseResponse<OpeningProgress>(response);
}
