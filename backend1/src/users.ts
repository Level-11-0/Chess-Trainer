import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { DATA_DIR } from "./paths.js";
import type { PublicUser } from "./types.js";

const scryptAsync = promisify(scrypt);
const USERS_PATH = join(DATA_DIR, "users.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const SESSION_COOKIE = "cta_session";

type StoredUser = {
  id: string;
  username: string;
  usernameKey: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  isAdmin: boolean;
};

type Session = {
  token: string;
  userId: string;
  expiresAt: number;
};

let users: StoredUser[] = [];
const sessions = new Map<string, Session>();
let loaded = false;

function envAdminName(): string | undefined {
  const value = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  return value && value.length > 0 ? value : undefined;
}

function shouldBeAdmin(usernameKey: string, isFirstUser: boolean): boolean {
  if (usernameKey === "admin") {
    return true;
  }
  const envAdmin = envAdminName();
  if (envAdmin) {
    return usernameKey === envAdmin;
  }
  return isFirstUser;
}

function applyAdminFlags(): boolean {
  let changed = false;
  const envAdmin = envAdminName();
  if (envAdmin) {
    for (const user of users) {
      const next = user.usernameKey === envAdmin || user.usernameKey === "admin";
      if (user.isAdmin !== next) {
        user.isAdmin = next;
        changed = true;
      }
    }
  } else if (users.length > 0 && !users.some((user) => user.isAdmin)) {
    const first = users[0];
    if (first) {
      first.isAdmin = true;
      changed = true;
    }
  }
  for (const user of users) {
    if (user.usernameKey === "admin" && !user.isAdmin) {
      user.isAdmin = true;
      changed = true;
    }
  }
  return changed;
}

async function ensureLoaded(): Promise<void> {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const raw = await readFile(USERS_PATH, "utf8");
    const parsed = JSON.parse(raw) as { users?: Array<StoredUser & { isAdmin?: boolean }> };
    users = (parsed.users ?? []).map((user) => ({
      ...user,
      isAdmin: Boolean(user.isAdmin),
    }));
  } catch {
    users = [];
  }
  if (applyAdminFlags()) {
    await persist();
  }
}

async function persist(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    USERS_PATH,
    `${JSON.stringify({ users }, null, 2)}\n`,
    "utf8",
  );
}

function publicUser(user: StoredUser): PublicUser {
  return { id: user.id, username: user.username, isAdmin: user.isAdmin };
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return derived.toString("hex");
}

export async function registerUser(
  username: string,
  password: string,
): Promise<{ user: PublicUser; token: string }> {
  await ensureLoaded();
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
    throw httpError(
      "Username must be 3–20 letters, numbers, or underscores",
      400,
    );
  }
  if (password.length < 8 || password.length > 72) {
    throw httpError("Password must be 8–72 characters", 400);
  }

  const usernameKey = trimmed.toLowerCase();
  if (users.some((user) => user.usernameKey === usernameKey)) {
    throw httpError("That username is already taken", 409);
  }

  const salt = randomBytes(16).toString("hex");
  const user: StoredUser = {
    id: randomUUID(),
    username: trimmed,
    usernameKey,
    passwordHash: await hashPassword(password, salt),
    salt,
    createdAt: new Date().toISOString(),
    isAdmin: shouldBeAdmin(usernameKey, users.length === 0),
  };
  users.push(user);
  await persist();
  return { user: publicUser(user), token: createSession(user.id) };
}

export async function loginUser(
  username: string,
  password: string,
): Promise<{ user: PublicUser; token: string }> {
  await ensureLoaded();
  const usernameKey = username.trim().toLowerCase();
  const user = users.find((item) => item.usernameKey === usernameKey);
  if (!user) {
    throw httpError("Invalid username or password", 401);
  }
  const hash = await hashPassword(password, user.salt);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(user.passwordHash, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw httpError("Invalid username or password", 401);
  }
  if (applyAdminFlags()) {
    await persist();
  }
  return { user: publicUser(user), token: createSession(user.id) };
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, {
    token,
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function destroySession(token: string | undefined): void {
  if (token) {
    sessions.delete(token);
  }
}

export async function userFromToken(
  token: string | undefined,
): Promise<PublicUser | null> {
  if (!token) {
    return null;
  }
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      sessions.delete(token);
    }
    return null;
  }
  await ensureLoaded();
  const user = users.find((item) => item.id === session.userId);
  return user ? publicUser(user) : null;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.split("=");
    if (!rawName) {
      continue;
    }
    out[rawName.trim()] = decodeURIComponent(rest.join("=").trim());
  }
  return out;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
