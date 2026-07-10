import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

let pool: Pool | null = null;

function boolEnv(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase());
}

export function getMysqlPool() {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST?.trim();
  const user = process.env.MYSQL_USER?.trim();
  const database = process.env.MYSQL_DATABASE?.trim();
  const password = process.env.MYSQL_PASSWORD ?? "";
  const port = Number(process.env.MYSQL_PORT || 3306);
  const sslEnabled = boolEnv(process.env.MYSQL_SSL);
  const sslCa = process.env.MYSQL_SSL_CA?.replace(/\\n/g, "\n");

  if (!host || !user || !database) {
    throw new Error("MySQL env vars are missing. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE.");
  }

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    charset: "utf8mb4",
    dateStrings: true,
    ssl: sslEnabled
      ? {
          rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false",
          ...(sslCa ? { ca: sslCa } : {})
        }
      : undefined,
    namedPlaceholders: false
  });

  return pool;
}

export async function mysqlQuery<T extends RowDataPacket[] | ResultSetHeader>(sql: string, params: unknown[] = []) {
  const [rows] = await (getMysqlPool() as any).execute(sql, params);
  return rows as T;
}

export async function mysqlExecute<T>(sql: string, params: unknown[] = []) {
  const [rows] = await (getMysqlPool() as any).execute(sql, params);
  return rows as T;
}

export async function withMysqlTransaction<T>(fn: (conn: PoolConnection) => Promise<T>) {
  const conn = await getMysqlPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export function toMysqlDate(value: unknown) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  if (typeof value !== "string") return value;
  return value.replace("T", " ").replace(/Z$/, "").replace(/\+\d\d:\d\d$/, "");
}

export function fromMysqlRow<T extends Record<string, unknown>>(row: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (Buffer.isBuffer(value)) {
      next[key] = value.toString("utf8");
    } else {
      next[key] = value;
    }
  }
  return next as T;
}
