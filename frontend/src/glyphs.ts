import type { Evaluation, MoveAnnotation } from "./types";

export function annotationLabel(annotation: MoveAnnotation): string {
  switch (annotation.kind) {
    case "book":
      return "Book";
    case "inaccuracy":
      return "Inaccuracy";
    case "mistake":
      return "Mistake";
    case "blunder":
      return "Blunder";
  }
}

export function annotationGlyph(annotation: MoveAnnotation): string {
  switch (annotation.glyph) {
    case "book":
      return "📖";
    case "?!":
      return "?!";
    case "?":
      return "?";
    case "??":
      return "??";
  }
}

export function evalLabel(evaluation: Evaluation | null): string {
  if (!evaluation) {
    return "0.0";
  }
  if (evaluation.type === "mate") {
    return evaluation.value > 0
      ? `M${evaluation.value}`
      : `-M${Math.abs(evaluation.value)}`;
  }
  const pawns = evaluation.value / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

export function evalBarPercent(evaluation: Evaluation | null): number {
  if (!evaluation) {
    return 50;
  }
  if (evaluation.type === "mate") {
    if (evaluation.value === 0) {
      return 50;
    }
    return evaluation.value > 0 ? 96 : 4;
  }
  const capped = Math.max(-400, Math.min(400, evaluation.value));
  return 50 + (capped / 400) * 46;
}

export function formatSan(san: string, annotation?: MoveAnnotation): string {
  if (!annotation || annotation.kind === "book") {
    return annotation?.kind === "book" ? `${san} 📖` : san;
  }
  return `${san}${annotation.glyph}`;
}
