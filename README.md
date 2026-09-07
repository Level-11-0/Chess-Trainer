# Opening Lab

A chess training app: browse opening courses from an admin-uploaded book, drill those lines on the board, and review games with Stockfish. The UI is a React + Vite frontend; the API is Express in `backend1/`.

Live demo (static GitHub Pages): [https://level-11-0.github.io/Chess-Trainer/](https://level-11-0.github.io/Chess-Trainer/)

Guests can browse the catalog and train against the shipped book. An account (and the Express API) is required to persist PGN studies, opening training progress, and Stockfish reviews.

## Features

- **Courses** (`#/`) — catalog of openings built from the book, with search and line counts
- **Train** (`#/train`, `#/train/<slug>`) — play book moves; the server (or the client-side book on Pages) replies, or hints a correct continuation on a wrong / out-of-book move
- **Review** (`#/review`) — paste or upload a PGN; Stockfish annotates inaccuracies, mistakes, and blunders (book moves are marked separately). The eval bar shows **+4 / +2 / 0 / −2 / −4** plus the current score. Review needs the API.
- **Studies** (`#/studies`) — save and reopen PGNs (signed-in only)
- **Book** (`#/book`) — admin-only PGN import

Course names use the PGN `Opening` header, otherwise `ECO` / `Event`, otherwise “Unnamed opening”.

## Run locally

Needs Node.js. Install and start each package in its own terminal:

```bash
# API — http://localhost:3001
cd backend1
npm install
npm run dev
```

```bash
# App — http://localhost:5173/
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/). Local `npm run dev` uses `base: '/'` and proxies `/api` to `http://127.0.0.1:3001` (`frontend/vite.config.ts`). Production / GitHub Pages builds use `base: '/Chess-Trainer/'`. The API also allows CORS from `localhost:5173` / `127.0.0.1:5173`.

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

Optional frontend build variable:

- `VITE_API_URL` — public API origin (no trailing slash). When set, the built app talks to that host instead of the static book.

## GitHub Pages

The repo name is **Chess-Trainer**. The production URL is:

`https://level-11-0.github.io/Chess-Trainer/`

Hash routes (`#/`, `#/train`, `#/train/ruy-lopez`, `#/review`) work under that subpath. Production Vite `base` is `/Chess-Trainer/` (override with `BASE_URL` if you fork under another name). Local `npm run dev` stays at `/`.

GitHub Pages is a static host and **cannot run Express or Stockfish**. Do not expect `/api` on `github.io` to reach your laptop.

On Pages, when `VITE_API_URL` is unset:

- **Catalog + trainer** run offline from `frontend/public/book.json` (chess.js + book positions in the browser)
- Guest progress stays in `sessionStorage`
- **Review / studies / accounts** show that they need the API instead of crashing on empty JSON

To enable Pages:

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Push to `main` (or run **Deploy to GitHub Pages** from the Actions tab)
3. Workflow: [`.github/workflows/pages.yml`](.github/workflows/pages.yml)

To point the Pages build at a hosted API later, set repository variable `VITE_API_URL` (Actions → Variables). Leave it unset to keep the offline book demo.

## Guest vs account

| | Guest | Account |
| --- | --- | --- |
| Browse courses, train | Yes (API or shipped book) | Yes |
| Review a PGN with Stockfish | API required | API required |
| Opening progress / trainer notes | This browser tab only (`sessionStorage`) | Saved under `backend1/data/` |
| PGN studies | Not stored | Saved and listed |
| Saved review history | Not stored | Saved for that user |

Sign-up usernames are 3–20 letters, numbers, or underscores; passwords are 8–72 characters.

## Admin

Admins see **Book** in the nav and can upload PGN to grow the opening catalog (API required).

A user becomes admin if any of these apply:

1. They are the first registered user and `ADMIN_USERNAME` is unset
2. Their username matches `ADMIN_USERNAME`
3. Their username is `admin`
4. `isAdmin` is set to `true` on their record in `backend1/data/users.json` (created at runtime)

If `ADMIN_USERNAME` is set, the API also reapplies admin flags on load/login so that username (and `admin`) stay admin.

## Data

Runtime JSON lives in `backend1/data/` (`users.json`, `book.json`, `progress.json`, `reviews.json`, `studies.json`). Those files are gitignored.

A committed snapshot of the recovered book lives in:

- `backend1/seed/book.json` — if `data/book.json` is missing or empty, the API restores this seed (users/progress/notes are not touched)
- `frontend/public/book.json` — same snapshot, used by the Pages/offline trainer

Admin PGN imports still write `backend1/data/book.json` when the API is running.

`backend1/node_modules` was committed earlier. `.gitignore` now excludes it — drop it from the index before the first GitHub push so language stats stay on your source (`git rm -r --cached backend1/node_modules`).

## License

MIT. See [LICENSE](LICENSE).
