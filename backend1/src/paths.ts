import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = join(ROOT, "../data");
export const SEED_BOOK_PATH = join(ROOT, "../seed/book.json");
