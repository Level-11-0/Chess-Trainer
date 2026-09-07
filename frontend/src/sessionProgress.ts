import type { OpeningProgress } from "./types";

const KEY = "cta_session_progress";

function empty(): OpeningProgress {
  return {
    learnedLineIds: [],
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

export function loadSessionProgress(): Record<string, OpeningProgress> {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, OpeningProgress>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function readSessionOpening(openingId: string): OpeningProgress {
  return loadSessionProgress()[openingId] ?? empty();
}

export function writeSessionOpening(
  openingId: string,
  progress: OpeningProgress,
): void {
  const all = loadSessionProgress();
  all[openingId] = {
    ...progress,
    updatedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(KEY, JSON.stringify(all));
}

export function clearSessionProgress(): void {
  sessionStorage.removeItem(KEY);
}

export function mergeProgress(
  remote: Record<string, OpeningProgress>,
  local: Record<string, OpeningProgress>,
): Record<string, { learnedLineIds: string[]; notes: string }> {
  const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
  const merged: Record<string, { learnedLineIds: string[]; notes: string }> = {};
  for (const key of keys) {
    const a = remote[key];
    const b = local[key];
    merged[key] = {
      learnedLineIds: [
        ...new Set([
          ...(a?.learnedLineIds ?? []),
          ...(b?.learnedLineIds ?? []),
        ]),
      ],
      notes: (a?.notes && a.notes.length > 0 ? a.notes : b?.notes) ?? "",
    };
  }
  return merged;
}
