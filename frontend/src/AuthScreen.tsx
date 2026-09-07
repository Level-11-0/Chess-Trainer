import type { FormEvent } from "react";
import { navigate } from "./hashRoute";

export function AuthScreen({
  mode,
  username,
  password,
  busy,
  error,
  onMode,
  onUsername,
  onPassword,
  onSubmit,
  onGuest,
}: {
  mode: "login" | "register";
  username: string;
  password: string;
  busy: boolean;
  error: string | null;
  onMode: (mode: "login" | "register") => void;
  onUsername: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: () => void;
  onGuest: () => void;
}) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section className="setup-card">
      <h2>{mode === "register" ? "Create account" : "Sign in"}</h2>
      <p className="muted">
        An account saves studies as PGNs and opening training progress. You can
        browse and train as a guest without one.
      </p>
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(event) => onUsername(event.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={20}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => onPassword(event.target.value)}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            minLength={8}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="primary" disabled={busy}>
          {mode === "register" ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        className="ghost guest-cta"
        onClick={() => {
          onGuest();
          navigate({ name: "home" });
        }}
      >
        Continue as guest
      </button>
      <button
        type="button"
        className="text-btn switch-auth"
        onClick={() => {
          onMode(mode === "register" ? "login" : "register");
        }}
      >
        {mode === "register"
          ? "Already have an account? Sign in"
          : "Need an account? Register"}
      </button>
    </section>
  );
}
