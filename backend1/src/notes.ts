import { slugifyOpening } from "./openingBook.js";
import { getOpeningProgress, upsertOpeningProgress } from "./progress.js";

function progressKey(openingName: string | undefined): string {
  const trimmed = openingName?.trim();
  return trimmed && trimmed.length > 0 ? slugifyOpening(trimmed) : "_default";
}

export async function getTrainerNote(
  userId: string,
  openingName?: string,
): Promise<string> {
  return (await getOpeningProgress(userId, progressKey(openingName))).notes;
}

export async function saveTrainerNote(
  userId: string,
  openingName: string | undefined,
  text: string,
): Promise<string> {
  const saved = await upsertOpeningProgress(userId, progressKey(openingName), {
    notes: text,
  });
  return saved.notes;
}
