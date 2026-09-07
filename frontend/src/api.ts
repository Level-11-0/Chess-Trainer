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

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

const jsonHeaders = { "Content-Type": "application/json" };

export async function fetchMe(): Promise<PublicUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (response.status === 401) {
    return null;
  }
  return parseResponse<PublicUser>(response);
}

export async function register(
  username: string,
  password: string,
): Promise<PublicUser> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  return parseResponse<PublicUser>(response);
}

export async function login(
  username: string,
  password: string,
): Promise<PublicUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  });
  return parseResponse<PublicUser>(response);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export async function listReviews(): Promise<ReviewListItem[]> {
  const response = await fetch("/api/reviews", { credentials: "include" });
  return parseResponse<ReviewListItem[]>(response);
}

export async function createReview(pgn: string): Promise<GameReview> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ pgn }),
  });
  return parseResponse<GameReview>(response);
}

export async function getReview(id: string): Promise<GameReview> {
  const response = await fetch(`/api/reviews/${id}`, {
    credentials: "include",
  });
  return parseResponse<GameReview>(response);
}

export async function listOpenings(): Promise<OpeningCourse[]> {
  const response = await fetch("/api/book/openings", {
    credentials: "include",
  });
  return parseResponse<OpeningCourse[]>(response);
}

export async function getOpening(slug: string): Promise<OpeningCourse> {
  const response = await fetch(`/api/book/openings/${slug}`, {
    credentials: "include",
  });
  return parseResponse<OpeningCourse>(response);
}

export async function listBookSources(): Promise<BookSource[]> {
  const response = await fetch("/api/book/sources", {
    credentials: "include",
  });
  return parseResponse<BookSource[]>(response);
}

export async function importBookPgn(pgn: string): Promise<{
  games: number;
  positions: number;
  sources: BookSource[];
}> {
  const response = await fetch("/api/book/pgns", {
    method: "POST",
    credentials: "include",
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
  const response = await fetch("/api/trainer/try", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
  return parseResponse<TrainerTryResult>(response);
}

export async function getTrainerNotes(openingName: string): Promise<string> {
  const params = new URLSearchParams();
  if (openingName) {
    params.set("opening", openingName);
  }
  const response = await fetch(`/api/trainer/notes?${params.toString()}`, {
    credentials: "include",
  });
  const payload = await parseResponse<{ text: string }>(response);
  return payload.text;
}

export async function saveTrainerNotes(
  openingName: string,
  text: string,
): Promise<void> {
  const response = await fetch("/api/trainer/notes", {
    method: "PUT",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ openingName, text }),
  });
  await parseResponse(response);
}

export async function listStudies(): Promise<StudyListItem[]> {
  const response = await fetch("/api/studies", { credentials: "include" });
  return parseResponse<StudyListItem[]>(response);
}

export async function createStudy(
  title: string,
  pgn: string,
): Promise<Study> {
  const response = await fetch("/api/studies", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ title, pgn }),
  });
  return parseResponse<Study>(response);
}

export async function getStudy(id: string): Promise<Study> {
  const response = await fetch(`/api/studies/${id}`, {
    credentials: "include",
  });
  return parseResponse<Study>(response);
}

export async function deleteStudy(id: string): Promise<void> {
  const response = await fetch(`/api/studies/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseResponse(response);
}

export async function getAllProgress(): Promise<
  Record<string, OpeningProgress>
> {
  const response = await fetch("/api/progress", { credentials: "include" });
  return parseResponse<Record<string, OpeningProgress>>(response);
}

export async function getProgress(
  openingId: string,
): Promise<OpeningProgress> {
  const response = await fetch(`/api/progress/${openingId}`, {
    credentials: "include",
  });
  return parseResponse<OpeningProgress>(response);
}

export async function putProgress(
  openingId: string,
  patch: { learnedLineIds?: string[]; notes?: string },
): Promise<OpeningProgress> {
  const response = await fetch(`/api/progress/${openingId}`, {
    method: "PUT",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(patch),
  });
  return parseResponse<OpeningProgress>(response);
}
