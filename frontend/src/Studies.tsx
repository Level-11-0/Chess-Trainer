import { useState, type ChangeEvent } from "react";
import type { StudyListItem } from "./types";

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

export function Studies({
  signedIn,
  studies,
  busy,
  error,
  onCreate,
  onDelete,
  onOpen,
  onNeedAuth,
}: {
  signedIn: boolean;
  studies: StudyListItem[];
  busy: boolean;
  error: string | null;
  onCreate: (title: string, pgn: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  onNeedAuth: () => void;
}) {
  const [title, setTitle] = useState("");
  const [pgn, setPgn] = useState("");

  if (!signedIn) {
    return (
      <section className="setup-card">
        <h2>Studies</h2>
        <p className="muted">
          Create an account to save studies as PGNs. Guests can review games in
          this session, but nothing is stored on the server.
        </p>
        <button type="button" className="primary" onClick={onNeedAuth}>
          Sign up to save studies
        </button>
      </section>
    );
  }

  return (
    <section className="setup-card wide">
      <h2>Your studies</h2>
      <p className="muted">
        Save a PGN with a title. Open one later to review it on the board.
      </p>
      <label className="field">
        <span>Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          placeholder="Italian Game notes"
        />
      </label>
      <label className="field">
        <span>PGN file</span>
        <input
          type="file"
          accept=".pgn,text/plain"
          onChange={(event) => readPgnFile(event, setPgn)}
        />
      </label>
      <label className="field">
        <span>Or paste PGN</span>
        <textarea
          value={pgn}
          onChange={(event) => setPgn(event.target.value)}
          rows={8}
          placeholder='[Event "Study"]...'
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button
        type="button"
        className="primary"
        disabled={busy || title.trim().length < 1 || pgn.trim().length < 10}
        onClick={() => {
          onCreate(title.trim(), pgn);
          setTitle("");
          setPgn("");
        }}
      >
        {busy ? "Saving…" : "Save study"}
      </button>
      {studies.length > 0 ? (
        <div className="review-list">
          <h3>Saved PGNs</h3>
          {studies.map((item) => (
            <div key={item.id} className="review-row static study-row">
              <div>
                <strong>{item.title}</strong>
                <span>{item.preview || "PGN study"}</span>
              </div>
              <div className="study-actions">
                <button
                  type="button"
                  className="ghost compact"
                  onClick={() => onOpen(item.id)}
                >
                  Review
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => onDelete(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
