import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./paths.js";
import type { Study, StudyListItem } from "./types.js";

const STUDIES_PATH = join(DATA_DIR, "studies.json");

type StudiesFile = {
  studies: Study[];
};

let studies: Study[] = [];
let loaded = false;

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

function previewPgn(pgn: string): string {
  const body = pgn
    .split("\n")
    .filter((line) => !line.startsWith("["))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return body.length > 90 ? `${body.slice(0, 87)}…` : body;
}

function toListItem(study: Study): StudyListItem {
  return {
    id: study.id,
    title: study.title,
    preview: previewPgn(study.pgn),
    createdAt: study.createdAt,
  };
}

async function ensureLoaded(): Promise<void> {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const raw = await readFile(STUDIES_PATH, "utf8");
    const parsed = JSON.parse(raw) as StudiesFile;
    studies = parsed.studies ?? [];
  } catch {
    studies = [];
  }
}

async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    STUDIES_PATH,
    `${JSON.stringify({ studies }, null, 2)}\n`,
    "utf8",
  );
}

export async function listStudies(userId: string): Promise<StudyListItem[]> {
  await ensureLoaded();
  return studies
    .filter((study) => study.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toListItem);
}

export async function createStudy(
  userId: string,
  title: string,
  pgn: string,
): Promise<Study> {
  await ensureLoaded();
  const trimmedTitle = title.trim();
  const trimmedPgn = pgn.trim();
  if (trimmedTitle.length < 1 || trimmedTitle.length > 80) {
    throw httpError("Title must be 1–80 characters", 400);
  }
  if (trimmedPgn.length < 10) {
    throw httpError("Paste or upload a PGN", 400);
  }
  if (trimmedPgn.length > 200_000) {
    throw httpError("PGN is too large", 400);
  }
  const study: Study = {
    id: randomUUID(),
    userId,
    title: trimmedTitle,
    pgn: trimmedPgn,
    createdAt: new Date().toISOString(),
  };
  studies.push(study);
  await persist();
  return study;
}

export async function getStudy(id: string, userId: string): Promise<Study> {
  await ensureLoaded();
  const study = studies.find((item) => item.id === id && item.userId === userId);
  if (!study) {
    throw httpError("Study not found", 404);
  }
  return study;
}

export async function deleteStudy(id: string, userId: string): Promise<void> {
  await ensureLoaded();
  const index = studies.findIndex(
    (item) => item.id === id && item.userId === userId,
  );
  if (index < 0) {
    throw httpError("Study not found", 404);
  }
  studies.splice(index, 1);
  await persist();
}
