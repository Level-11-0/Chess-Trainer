export type Evaluation = {
  type: "cp" | "mate";
  value: number;
};

export type MoveAnnotationKind =
  | "book"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export type MoveAnnotation = {
  kind: MoveAnnotationKind;
  glyph: "book" | "?!" | "?" | "??";
};

export type PublicUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export type ReviewStatus = "analyzing" | "ready" | "error";

export type ReviewedMove = {
  ply: number;
  san: string;
  from: string;
  to: string;
  color: "w" | "b";
  promotion?: string;
  fen: string;
  evaluation: Evaluation | null;
  bestEvaluation: Evaluation | null;
  lossCp: number;
  annotation?: MoveAnnotation;
  bestMove?: string;
  openingName?: string;
};

export type ReviewSummary = {
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  worst: {
    ply: number;
    san: string;
    color: "w" | "b";
    lossCp: number;
    kind: MoveAnnotationKind;
  }[];
};

export type GameReview = {
  id: string;
  userId: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  event: string;
  date: string;
  status: ReviewStatus;
  progress: { analyzed: number; total: number };
  error?: string;
  startingFen: string;
  moves: ReviewedMove[];
  summary: ReviewSummary;
  createdAt: string;
};

export type ReviewListItem = {
  id: string;
  white: string;
  black: string;
  result: string;
  event: string;
  date: string;
  status: ReviewStatus;
  progress: { analyzed: number; total: number };
  summary: ReviewSummary;
  createdAt: string;
};

export type BookMove = {
  uci: string;
  san: string;
  from: string;
  to: string;
  promotion?: string;
  openingName: string;
};

export type BookSource = {
  id: string;
  openingName: string;
  eco?: string;
  preview: string;
  plyCount: number;
  uploadedAt: string;
};

export type OpeningLine = {
  id: string;
  preview: string;
  plyCount: number;
};

export type OpeningCourse = {
  slug: string;
  name: string;
  description: string;
  preview: string;
  fen: string;
  lineCount: number;
  eco?: string;
  lines: OpeningLine[];
};

export type OpeningOption = OpeningCourse;

export type TrainerTryResult = {
  status: "book" | "wrong" | "out_of_book";
  openingName?: string;
  message: string;
  suggestion?: BookMove;
  nextFen?: string;
  reply?: BookMove;
  replyFen?: string;
  lineComplete?: boolean;
};

export type Study = {
  id: string;
  userId: string;
  title: string;
  pgn: string;
  createdAt: string;
};

export type StudyListItem = {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
};

export type OpeningProgress = {
  learnedLineIds: string[];
  notes: string;
  updatedAt: string;
};

export const ANALYZE_DEPTH = 8;
export const ANALYZE_MULTI_PV = 3;
export const MAX_REVIEW_PLIES = 160;
export const MAX_BOOK_PLIES = 24;
