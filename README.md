# Opening Lab

A local chess training app: browse opening courses from an admin-uploaded book, drill those lines on the board, and review games with Stockfish. The UI is a React + Vite frontend; the API is Express in `backend1/`.

Guests can browse the catalog, train, and run a PGN review. An account is required to persist PGN studies and opening training progress on the server.

## Features

- **Courses** (`#/`) — catalog of openings built from the book, with search and line counts
- **Train** (`#/train`, `#/train/<slug>`) — play book moves; the server replies from the book, or hints a correct continuation on a wrong / out-of-book move
- **Review** (`#/review`) — paste or upload a PGN; Stockfish annotates inaccuracies, mistakes, and blunders (book moves are marked separately)
- **Studies** (`#/studies`) — save and reopen PGNs (signed-in only)
- **Book** (`#/book`) — admin-only PGN import; there is no built-in opening library

The opening book comes only from admin PGN uploads. Course names use the PGN `Opening` header, otherwise `ECO` / `Event`, otherwise “Unnamed opening”.

## Run locally

Needs Node.js. Install and start each package in its own terminal:

```bash
# API — http://localhost:3001
cd backend1
npm install
npm run dev
```

```bash
# App — http://localhost:5173  (proxies /api to the backend)
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to port 3001 (`frontend/vite.config.ts`). The API also allows CORS from `localhost:5173` / `127.0.0.1:5173`.

| Script | Where | What |
| --- | --- | --- |
| `npm run dev` | `frontend/` | Vite dev server (port 5173) |
| `npm run build` | `frontend/` | Typecheck + production build |
| `npm run preview` | `frontend/` | Serve the production build |
| `npm run lint` | `frontend/` | Oxlint |
| `npm run dev` | `backend1/` | Express with reload (`tsx watch`) |
| `npm start` | `backend1/` | Express once |
| `npm run build` | `backend1/` | `tsc` → `dist/` |

Optional environment variables for the API:

- `PORT` — listen port (default `3001`)
- `ADMIN_USERNAME` — username that should be treated as admin (case-insensitive)

## Guest vs account

| | Guest | Account |
| --- | --- | --- |
| Browse courses, train, review a PGN | Yes | Yes |
| Opening progress / trainer notes | This browser tab only (`sessionStorage`) | Saved under `backend1/data/` |
| PGN studies | Not stored | Saved and listed |
| Saved review history | Not stored | Saved for that user |

Sign-up usernames are 3–20 letters, numbers, or underscores; passwords are 8–72 characters.

## Admin

Admins see **Book** in the nav and can upload PGN to grow the opening catalog.

A user becomes admin if any of these apply:

1. They are the first registered user and `ADMIN_USERNAME` is unset
2. Their username matches `ADMIN_USERNAME`
3. Their username is `admin`
4. `isAdmin` is set to `true` on their record in `backend1/data/users.json` (created at runtime)

If `ADMIN_USERNAME` is set, the API also reapplies admin flags on load/login so that username (and `admin`) stay admin.

## Data

Runtime JSON lives in `backend1/data/` (`users.json`, `book.json`, `progress.json`, `reviews.json`, `studies.json`). Those files are gitignored; they are created when the API first writes them. There is no database.

`backend1/node_modules` was committed earlier. `.gitignore` now excludes it — drop it from the index before the first GitHub push so language stats stay on your source (`git rm -r --cached backend1/node_modules`).

## License

MIT. See [LICENSE](LICENSE).
