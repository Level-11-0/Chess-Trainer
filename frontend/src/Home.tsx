import { MiniBoard } from "./MiniBoard";
import { navigate } from "./hashRoute";
import type { OpeningCourse, OpeningProgress } from "./types";

function progressRatio(
  course: OpeningCourse,
  progress: OpeningProgress | undefined,
): number {
  if (course.lineCount === 0) {
    return 0;
  }
  const learned = progress?.learnedLineIds.length ?? 0;
  return Math.min(1, learned / course.lineCount);
}

export function Home({
  courses,
  progress,
  search,
  onSearch,
}: {
  courses: OpeningCourse[];
  progress: Record<string, OpeningProgress>;
  search: string;
  onSearch: (value: string) => void;
}) {
  const query = search.trim().toLowerCase();
  const filtered = courses.filter((course) => {
    if (!query) {
      return true;
    }
    return (
      course.name.toLowerCase().includes(query) ||
      course.preview.toLowerCase().includes(query) ||
      (course.eco ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <section className="catalog">
      <div className="hero">
        <h1>Chess Opening Courses</h1>
        <p className="muted">
          Browse lines from your book, then train them on the board.
        </p>
        <label className="search-field">
          <span className="sr-only">Search openings</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search openings"
            type="search"
          />
        </label>
      </div>
      {filtered.length === 0 ? (
        <p className="muted center-note">
          {courses.length === 0
            ? "No openings in the book yet. An admin can upload PGN lines."
            : "No openings match that search."}
        </p>
      ) : (
        <div className="course-grid">
          {filtered.map((course) => {
            const ratio = progressRatio(course, progress[course.slug]);
            const started = (progress[course.slug]?.learnedLineIds.length ?? 0) > 0;
            return (
              <article key={course.slug} className="course-card">
                <MiniBoard fen={course.fen} />
                <div className="course-body">
                  <h2>{course.name}</h2>
                  <p className="course-copy">{course.description}</p>
                  <p className="course-meta">
                    {course.lineCount}{" "}
                    {course.lineCount === 1 ? "line" : "lines"}
                  </p>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(ratio * 100)}
                  >
                    <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                  <button
                    type="button"
                    className="primary"
                    onClick={() =>
                      navigate({ name: "train", slug: course.slug })
                    }
                  >
                    {started ? "Start learning" : "Try the first line"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
