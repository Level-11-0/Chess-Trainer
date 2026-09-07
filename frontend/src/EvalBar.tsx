import { evalBarPercent, evalLabel } from "./glyphs";
import type { Evaluation } from "./types";

const TICKS = [
  { label: "+4", pawns: 4 },
  { label: "+2", pawns: 2 },
  { label: "0", pawns: 0 },
  { label: "−2", pawns: -2 },
  { label: "−4", pawns: -4 },
];

function tickBottom(pawns: number): string {
  return `${50 + (pawns / 4) * 46}%`;
}

export function EvalBar({
  evaluation,
  height,
}: {
  evaluation: Evaluation | null;
  height?: number;
}) {
  const percent = evalBarPercent(evaluation);
  const label = evalLabel(evaluation);
  return (
    <div
      className="eval-bar"
      title={`Evaluation ${label}`}
      style={height ? { height, minHeight: height } : undefined}
    >
      <div className="eval-white" style={{ height: `${percent}%` }} />
      {TICKS.map((tick) => (
        <span
          key={tick.label}
          className="eval-tick"
          style={{ bottom: tickBottom(tick.pawns) }}
        >
          {tick.label}
        </span>
      ))}
      <span className="eval-label">{label}</span>
    </div>
  );
}
