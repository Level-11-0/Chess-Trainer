import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./paths.js";
import type { OpeningProgress } from "./types.js";

const PROGRESS_PATH = join(DATA_DIR, "progress.json");

type ProgressFile = {
  progress: Record<string, Record<string, OpeningProgress>>;
};

let store: ProgressFile = { progress: {} };
let loaded = false;

function emptyProgress(): OpeningProgress {
  return {
    learnedLineIds: [],
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

async function ensureLoaded(): Promise<void> {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const raw = await readFile(PROGRESS_PATH, "utf8");
    const parsed = JSON.parse(raw) as ProgressFile;
    store = { progress: parsed.progress ?? {} };
  } catch {
    store = { progress: {} };
  }
}

async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    PROGRESS_PATH,
    `${JSON.stringify(store, null, 2)}\n`,
    "utf8",
  );
}

export async function getAllProgress(
  userId: string,
): Promise<Record<string, OpeningProgress>> {
  await ensureLoaded();
  return store.progress[userId] ?? {};
}

export async function getOpeningProgress(
  userId: string,
  openingId: string,
): Promise<OpeningProgress> {
  await ensureLoaded();
  return store.progress[userId]?.[openingId] ?? emptyProgress();
}

export async function upsertOpeningProgress(
  userId: string,
  openingId: string,
  patch: { learnedLineIds?: string[]; notes?: string },
): Promise<OpeningProgress> {
  await ensureLoaded();
  const current = store.progress[userId]?.[openingId] ?? emptyProgress();
  const next: OpeningProgress = {
    learnedLineIds: patch.learnedLineIds
      ? [...new Set(patch.learnedLineIds.filter((id) => id.length > 0))]
      : current.learnedLineIds,
    notes: typeof patch.notes === "string" ? patch.notes : current.notes,
    updatedAt: new Date().toISOString(),
  };
  const userProgress = store.progress[userId] ?? {};
  userProgress[openingId] = next;
  store.progress[userId] = userProgress;
  await persist();
  return next;
}
