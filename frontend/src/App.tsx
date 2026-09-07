import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createStudy,
  deleteStudy,
  fetchMe,
  getAllProgress,
  getStudy,
  importBookPgn,
  listBookSources,
  listOpenings,
  listStudies,
  login,
  logout,
  putProgress,
  register,
} from "./api";
import { AuthScreen } from "./AuthScreen";
import { BookAdmin } from "./BookAdmin";
import { Home } from "./Home";
import { ReviewScreen } from "./ReviewScreen";
import { Studies } from "./Studies";
import { Trainer } from "./Trainer";
import { navigate, parseHash, type AppRoute } from "./hashRoute";
import {
  clearSessionProgress,
  loadSessionProgress,
  mergeProgress,
  writeSessionOpening,
} from "./sessionProgress";
import type {
  BookSource,
  OpeningCourse,
  OpeningProgress,
  PublicUser,
  StudyListItem,
} from "./types";
import "./App.css";

const GUEST_KEY = "opening-lab-guest";

function emptyProgress(): OpeningProgress {
  return {
    learnedLineIds: [],
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function navClass(active: boolean) {
  return active ? "nav-link active" : "nav-link";
}

export default function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window === "undefined"
      ? { name: "home" }
      : parseHash(window.location.hash),
  );
  const [courses, setCourses] = useState<OpeningCourse[]>([]);
  const [progress, setProgress] = useState<Record<string, OpeningProgress>>(
    () => loadSessionProgress(),
  );
  const [studies, setStudies] = useState<StudyListItem[]>([]);
  const [sources, setSources] = useState<BookSource[]>([]);
  const [bookPgn, setBookPgn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reviewPgn, setReviewPgn] = useState<string | undefined>();

  const signedIn = Boolean(user);
  const trainSlug = route.name === "train" ? route.slug : undefined;
  const course = useMemo(
    () => courses.find((item) => item.slug === trainSlug) ?? null,
    [courses, trainSlug],
  );
  const openingId = course?.slug ?? "_default";
  const openingProgress = progress[openingId] ?? emptyProgress();

  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    void fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    void listOpenings()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (!user) {
      setStudies([]);
      setProgress(loadSessionProgress());
      return;
    }
    void listStudies()
      .then(setStudies)
      .catch(() => setStudies([]));
    void getAllProgress()
      .then(async (remote) => {
        const merged = mergeProgress(remote, loadSessionProgress());
        const next: Record<string, OpeningProgress> = {};
        for (const [id, patch] of Object.entries(merged)) {
          next[id] = await putProgress(id, patch);
        }
        setProgress({ ...remote, ...next });
        clearSessionProgress();
      })
      .catch(() => setProgress({}));
  }, [user]);

  useEffect(() => {
    if (!user?.isAdmin || route.name !== "book") {
      return;
    }
    void listBookSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, [route.name, user]);

  const goAuth = useCallback((mode: "login" | "register") => {
    setAuthMode(mode);
    setError(null);
    navigate({ name: "auth" });
  }, []);

  const onAuth = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next =
        authMode === "register"
          ? await register(username, password)
          : await login(username, password);
      sessionStorage.removeItem(GUEST_KEY);
      setUser(next);
      setPassword("");
      navigate({ name: "home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }, [authMode, password, username]);

  const onLogout = useCallback(async () => {
    await logout();
    setUser(null);
    setStudies([]);
    sessionStorage.setItem(GUEST_KEY, "1");
    navigate({ name: "home" });
  }, []);

  const onGuest = useCallback(() => {
    sessionStorage.setItem(GUEST_KEY, "1");
    setError(null);
  }, []);

  const onProgress = useCallback(
    (next: OpeningProgress, persist: boolean) => {
      setProgress((current) => ({ ...current, [openingId]: next }));
      if (!persist) {
        writeSessionOpening(openingId, next);
        return;
      }
      if (!signedIn) {
        writeSessionOpening(openingId, next);
        return;
      }
      void putProgress(openingId, {
        learnedLineIds: next.learnedLineIds,
        notes: next.notes,
      }).then((saved) => {
        setProgress((current) => ({ ...current, [openingId]: saved }));
      });
    },
    [openingId, signedIn],
  );

  const onCreateStudy = useCallback(
    (title: string, pgn: string) => {
      setBusy(true);
      setError(null);
      void createStudy(title, pgn)
        .then(async () => setStudies(await listStudies()))
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Could not save study"),
        )
        .finally(() => setBusy(false));
    },
    [],
  );

  const onDeleteStudy = useCallback((id: string) => {
    void deleteStudy(id)
      .then(async () => setStudies(await listStudies()))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not delete study"),
      );
  }, []);

  const onOpenStudy = useCallback((id: string) => {
    void getStudy(id)
      .then((study) => {
        setReviewPgn(study.pgn);
        navigate({ name: "review" });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not open study"),
      );
  }, []);

  if (!authReady) {
    return (
      <div className="app-shell">
        <p className="muted center-note">Loading…</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button
          type="button"
          className="site-brand"
          onClick={() => navigate({ name: "home" })}
        >
          Opening Lab
        </button>
        <nav className="site-nav">
          <button
            type="button"
            className={navClass(route.name === "home")}
            onClick={() => navigate({ name: "home" })}
          >
            Courses
          </button>
          <button
            type="button"
            className={navClass(route.name === "train")}
            onClick={() => navigate({ name: "train" })}
          >
            Train
          </button>
          <button
            type="button"
            className={navClass(route.name === "review")}
            onClick={() => navigate({ name: "review" })}
          >
            Review
          </button>
          <button
            type="button"
            className={navClass(route.name === "studies")}
            onClick={() => navigate({ name: "studies" })}
          >
            Studies
          </button>
          {user?.isAdmin ? (
            <button
              type="button"
              className={navClass(route.name === "book")}
              onClick={() => navigate({ name: "book" })}
            >
              Book
            </button>
          ) : null}
        </nav>
        <div className="site-auth">
          {user ? (
            <>
              <span className="user-label">
                {user.username}
                {user.isAdmin ? " · admin" : ""}
              </span>
              <button type="button" className="text-btn" onClick={() => void onLogout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <span className="user-label">Guest</span>
              <button type="button" className="text-btn" onClick={() => goAuth("register")}>
                Sign up
              </button>
              <button type="button" className="text-btn" onClick={() => goAuth("login")}>
                Log in
              </button>
            </>
          )}
        </div>
      </header>

      {!user && route.name !== "auth" ? (
        <p className="guest-banner">
          Sign up to save studies and training progress.
        </p>
      ) : null}

      {route.name === "auth" ? (
        <AuthScreen
          mode={authMode}
          username={username}
          password={password}
          busy={busy}
          error={error}
          onMode={(mode) => {
            setAuthMode(mode);
            setError(null);
          }}
          onUsername={setUsername}
          onPassword={setPassword}
          onSubmit={() => void onAuth()}
          onGuest={onGuest}
        />
      ) : route.name === "home" ? (
        <Home
          courses={courses}
          progress={progress}
          search={search}
          onSearch={setSearch}
        />
      ) : route.name === "train" ? (
        <Trainer
          key={openingId}
          course={course}
          courses={courses}
          progress={openingProgress}
          signedIn={signedIn}
          onProgress={onProgress}
          onNeedAuth={() => goAuth("register")}
        />
      ) : route.name === "studies" ? (
        <Studies
          signedIn={signedIn}
          studies={studies}
          busy={busy}
          error={error}
          onCreate={onCreateStudy}
          onDelete={onDeleteStudy}
          onOpen={onOpenStudy}
          onNeedAuth={() => goAuth("register")}
        />
      ) : route.name === "book" && user?.isAdmin ? (
        <BookAdmin
          bookPgn={bookPgn}
          sources={sources}
          busy={busy}
          error={error}
          notice={notice}
          onBookPgn={setBookPgn}
          onImport={() => {
            setBusy(true);
            setError(null);
            void importBookPgn(bookPgn)
              .then(async (result) => {
                setSources(await listBookSources());
                setCourses(await listOpenings());
                setBookPgn("");
                setNotice(
                  `Added ${result.games} game(s), ${result.positions} new book moves.`,
                );
              })
              .catch((err) =>
                setError(
                  err instanceof Error ? err.message : "Could not import book",
                ),
              )
              .finally(() => setBusy(false));
          }}
        />
      ) : (
        <ReviewScreen
          key={reviewPgn ?? "review"}
          user={user}
          initialPgn={reviewPgn}
          onNeedAuth={() => goAuth("register")}
          onSaveStudy={async (title, pgn) => {
            await createStudy(title, pgn);
            setStudies(await listStudies());
          }}
        />
      )}
    </div>
  );
}
