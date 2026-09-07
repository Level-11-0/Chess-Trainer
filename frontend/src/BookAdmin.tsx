import type { ChangeEvent } from "react";
import type { BookSource } from "./types";

function readPgnFile(
  event: ChangeEvent<HTMLInputElement>,
  onText: (text: string) => void,
) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onText(String(reader.result ?? ""));
  reader.readAsText(file);
}

export function BookAdmin({
  bookPgn,
  sources,
  busy,
  error,
  notice,
  onBookPgn,
  onImport,
}: {
  bookPgn: string;
  sources: BookSource[];
  busy: boolean;
  error: string | null;
  notice: string | null;
  onBookPgn: (value: string) => void;
  onImport: () => void;
}) {
  return (
    <section className="setup-card wide">
      <h2>Add book from PGN</h2>
      <p className="muted">
        Only admins can add lines. Opening names come from the PGN Opening
        header, otherwise ECO/Event, otherwise “Unnamed opening”.
      </p>
      <label className="field">
        <span>PGN file</span>
        <input
          type="file"
          accept=".pgn,text/plain"
          onChange={(event) => readPgnFile(event, onBookPgn)}
        />
      </label>
      <label className="field">
        <span>Or paste PGN</span>
        <textarea
          value={bookPgn}
          onChange={(event) => onBookPgn(event.target.value)}
          rows={8}
          placeholder='[Opening "Ruy Lopez"]...'
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <button
        type="button"
        className="primary"
        disabled={busy || bookPgn.trim().length < 10}
        onClick={onImport}
      >
        {busy ? "Importing…" : "Add to book"}
      </button>
      {sources.length > 0 ? (
        <div className="review-list">
          <h3>Book lines</h3>
          {sources.map((item) => (
            <div key={item.id} className="review-row static">
              <strong>{item.openingName}</strong>
              <span>
                {item.eco ? `${item.eco} · ` : ""}
                {item.preview}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
