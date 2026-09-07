import {
  coursesFromStoredBook,
  evaluateTrainerMove,
  type StoredBook,
} from "./bookEngine";
import type { BookSource, OpeningCourse, TrainerTryResult } from "./types";

let bookPromise: Promise<StoredBook> | null = null;

export function loadOfflineBook(): Promise<StoredBook> {
  if (!bookPromise) {
    bookPromise = fetch(`${import.meta.env.BASE_URL}book.json`).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(`Could not load opening book (${response.status})`);
        }
        const text = await response.text();
        if (!text.trim()) {
          throw new Error("Opening book file is empty");
        }
        return JSON.parse(text) as StoredBook;
      },
    );
  }
  return bookPromise;
}

export async function offlineListOpenings(): Promise<OpeningCourse[]> {
  return coursesFromStoredBook(await loadOfflineBook());
}

export async function offlineGetOpening(slug: string): Promise<OpeningCourse> {
  const course = (await offlineListOpenings()).find((item) => item.slug === slug);
  if (!course) {
    throw new Error("Opening not found");
  }
  return course;
}

export async function offlineListBookSources(): Promise<BookSource[]> {
  const book = await loadOfflineBook();
  return [...book.sources].sort((a, b) =>
    b.uploadedAt.localeCompare(a.uploadedAt),
  );
}

export async function offlineTryTrainerMove(input: {
  fen: string;
  from: string;
  to: string;
  promotion?: string;
  preferredOpening?: string;
}): Promise<TrainerTryResult> {
  return evaluateTrainerMove(await loadOfflineBook(), input);
}
