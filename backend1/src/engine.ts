import { Stockfish } from "@se-oss/stockfish";
import type { Evaluation } from "./types.js";

let enginePromise: Promise<Stockfish> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function getEngine(): Promise<Stockfish> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const engine = new Stockfish();
      await engine.waitReady();
      await engine.setOptions({ Hash: 64, Threads: 1 });
      return engine;
    })();
  }
  return enginePromise;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export type ScoredLine = {
  uci: string;
  evaluation: Evaluation;
};

function lineFromAnalysis(
  pv: string | undefined,
  score: Evaluation | undefined,
): ScoredLine | null {
  if (!pv || !score) {
    return null;
  }
  const uci = pv.split(/\s+/)[0];
  if (!uci) {
    return null;
  }
  return { uci, evaluation: score };
}

export async function analyzeLines(
  fen: string,
  depth: number,
  multipv: number,
): Promise<{ bestmove: string; lines: ScoredLine[] }> {
  return enqueue(async () => {
    const engine = await getEngine();
    await engine.setOptions({
      MultiPV: Math.max(1, multipv),
    });
    const analysis = await engine.analyze(fen, depth, Math.max(1, multipv));
    const seen = new Set<string>();
    const lines: ScoredLine[] = [];
    for (const line of analysis.lines) {
      const scored = lineFromAnalysis(line.pv, line.score);
      if (!scored || seen.has(scored.uci)) {
        continue;
      }
      seen.add(scored.uci);
      lines.push(scored);
    }
    return { bestmove: analysis.bestmove, lines };
  });
}

export function flipEvaluation(evaluation: Evaluation): Evaluation {
  return { type: evaluation.type, value: -evaluation.value };
}

export async function warmupEngine(): Promise<void> {
  await getEngine();
}
