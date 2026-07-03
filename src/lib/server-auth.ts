import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { mysqlExecute, toMysqlDate } from "./mysql";

export const SESSION_COOKIE_NAME = "dreamface_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AppSession = {
  access_token: string;
  expires_at: string;
  user: AuthUser;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashAuthToken(value: string) {
  return sha256(value);
}

export function newAuthToken() {
  return randomBytes(32).toString("hex");
}

export function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function getUserByEmail(email: string) {
  const rows = await mysqlExecute<RowDataPacket[]>("select id, email from users where email = ? limit 1", [
    email.trim().toLowerCase()
  ]);
  const row = rows[0];
  return row ? { id: String(row.id), email: row.email ? String(row.email) : null } : null;
}

export async function getUserIdsForAuthUser(user: AuthUser) {
  const ids = new Set<string>([user.id]);
  const normalizedEmail = user.email?.trim().toLowerCase();
  if (!normalizedEmail) return Array.from(ids);

  const rows = await mysqlExecute<RowDataPacket[]>(
    "select id from users where email = ? order by created_at asc",
    [normalizedEmail]
  );
  for (const row of rows) {
    if (row.id) ids.add(String(row.id));
  }
  return Array.from(ids);
}

export async function upsertEmailUser(email: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await getUserByEmail(normalized);
  if (existing) return existing;

  const id = randomUUID();
  const now = toMysqlDate(new Date());
  await mysqlExecute(
    "insert into users (id, email, created_at, updated_at, last_sign_in_at, provider, raw_app_meta_data, raw_user_meta_data) values (?, ?, ?, ?, ?, 'email', ?, ?)",
    [id, normalized, now, now, now, JSON.stringify({ provider: "email", providers: ["email"] }), JSON.stringify({})]
  );
  await mysqlExecute(
    "insert into user_identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at) values (?, ?, 'email', ?, ?, ?, ?, ?)",
    [`email:${normalized}`, id, normalized, JSON.stringify({ email: normalized }), now, now, now]
  );
  return { id, email: normalized };
}

export async function upsertGoogleUser(input: {
  googleSub: string;
  email: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  raw?: unknown;
}) {
  const now = toMysqlDate(new Date());
  const identityRows = await mysqlExecute<RowDataPacket[]>(
    "select user_id from user_identities where provider = 'google' and provider_id = ? limit 1",
    [input.googleSub]
  );
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  let userId = identityRows[0]?.user_id ? String(identityRows[0].user_id) : null;
  if (!userId && normalizedEmail) {
    const existing = await getUserByEmail(normalizedEmail);
    userId = existing?.id || null;
  }
  if (!userId) {
    userId = randomUUID();
    await mysqlExecute(
      "insert into users (id, email, created_at, updated_at, last_sign_in_at, provider, google_sub, avatar_url, full_name, raw_app_meta_data, raw_user_meta_data) values (?, ?, ?, ?, ?, 'google', ?, ?, ?, ?, ?)",
      [
        userId,
        normalizedEmail,
        now,
        now,
        now,
        input.googleSub,
        input.avatarUrl || null,
        input.fullName || null,
        JSON.stringify({ provider: "google", providers: ["google"] }),
        JSON.stringify(input.raw || {})
      ]
    );
  } else {
    await mysqlExecute(
      "update users set email = coalesce(?, email), updated_at = ?, last_sign_in_at = ?, provider = 'google', google_sub = ?, avatar_url = coalesce(?, avatar_url), full_name = coalesce(?, full_name) where id = ?",
      [normalizedEmail, now, now, input.googleSub, input.avatarUrl || null, input.fullName || null, userId]
    );
  }
  await mysqlExecute(
    "insert into user_identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at) values (?, ?, 'google', ?, ?, ?, ?, ?) on duplicate key update user_id = values(user_id), identity_data = values(identity_data), updated_at = values(updated_at), last_sign_in_at = values(last_sign_in_at)",
    [`google:${input.googleSub}`, userId, input.googleSub, JSON.stringify(input.raw || {}), now, now, now]
  );
  return { id: userId, email: normalizedEmail };
}

export async function createSession(user: AuthUser): Promise<AppSession> {
  const token = newAuthToken();
  const expiresAt = sessionExpiresAt();
  await mysqlExecute("insert into sessions (id, user_id, expires_at, created_at) values (?, ?, ?, ?)", [
    hashAuthToken(token),
    user.id,
    toMysqlDate(expiresAt),
    toMysqlDate(new Date())
  ]);
  return {
    access_token: token,
    expires_at: expiresAt.toISOString(),
    user
  };
}

export async function getSessionFromToken(token: string | null | undefined): Promise<AppSession | null> {
  if (!token) return null;
  const rows = await mysqlExecute<RowDataPacket[]>(
    "select s.expires_at, u.id, u.email from sessions s join users u on u.id = s.user_id where s.id = ? and s.expires_at > now(6) limit 1",
    [hashAuthToken(token.trim())]
  );
  const row = rows[0];
  if (!row) return null;
  const expiresAt = String(row.expires_at || "");
  const normalizedExpiresAt = expiresAt.includes("T") ? expiresAt : expiresAt.replace(" ", "T");
  return {
    access_token: token.trim(),
    expires_at: new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(normalizedExpiresAt) ? normalizedExpiresAt : `${normalizedExpiresAt}Z`).toISOString(),
    user: {
      id: String(row.id),
      email: row.email ? String(row.email) : null
    }
  };
}

export async function deleteSession(token: string | null | undefined) {
  if (!token) return;
  await mysqlExecute("delete from sessions where id = ?", [hashAuthToken(token.trim())]);
}

export async function getUserFromBearerToken(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const session = await getSessionFromToken(authHeader.slice("Bearer ".length));
  return session?.user || null;
}
