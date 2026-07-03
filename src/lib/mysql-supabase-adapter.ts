import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { fromMysqlRow, mysqlExecute, toMysqlDate, withMysqlTransaction } from "./mysql";
import { siteUrl } from "./site-url";

type QueryResult<T = unknown> = { data: T | null; error: null | MysqlAdapterError };
type Filter = { column: string; op: string; value: unknown };
type Order = { column: string; ascending: boolean };

const JSON_COLUMNS = new Set([
  "raw_app_meta_data",
  "raw_user_meta_data",
  "identity_data",
  "raw_result",
  "request_settings",
  "value",
  "properties"
]);

const DATE_COLUMNS = new Set([
  "created_at",
  "updated_at",
  "last_sign_in_at",
  "expires_at",
  "consumed_at",
  "published_at",
  "deleted_at",
  "last_checked_at",
  "timed_out_at",
  "current_period_start",
  "current_period_end",
  "canceled_at",
  "refunded_at"
]);

const TABLE_CONFLICT_KEYS: Record<string, string[]> = {
  users: ["id"],
  user_identities: ["id"],
  user_credit_accounts: ["user_id"],
  signup_ip_claims: ["ip_hash"],
  runtime_settings: ["key"],
  model_daily_usage_events: ["user_id", "model_key", "reference_id"],
  credit_purchases: ["stripe_checkout_id"],
  user_subscriptions: ["stripe_subscription_id"],
  public_gallery_items: ["id"],
  generation_tasks: ["id"],
  analytics_events: ["id"]
};

const TABLE_TIMESTAMP_DEFAULTS: Record<string, string[]> = {
  analytics_events: ["created_at"],
  credit_purchases: ["created_at", "updated_at"],
  generation_tasks: ["created_at", "updated_at"],
  public_gallery_items: ["published_at", "created_at"],
  signup_ip_claims: ["created_at"],
  user_credit_accounts: ["created_at", "updated_at"],
  user_subscriptions: ["created_at", "updated_at"]
};

export class MysqlAdapterError extends Error {
  code?: string;
  details?: string;

  constructor(message: string, code?: string, details?: string) {
    super(message);
    this.name = "MysqlAdapterError";
    this.code = code;
    this.details = details;
  }
}

function quoteIdent(value: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new MysqlAdapterError(`Unsafe SQL identifier: ${value}`);
  return `\`${value}\``;
}

function normalizeSelectColumns(columns?: string) {
  if (!columns || columns.trim() === "*") return "*";
  return columns
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^([A-Za-z0-9_]+)(?:\s*:\s*([A-Za-z0-9_]+))?$/);
      if (!match) return "*";
      return quoteIdent(match[2] || match[1]);
    })
    .join(", ");
}

function normalizeValue(column: string, value: unknown) {
  if (value === undefined) return null;
  if (JSON_COLUMNS.has(column)) return value == null ? null : JSON.stringify(value);
  if (DATE_COLUMNS.has(column)) return toMysqlDate(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function normalizeRow(row: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    next[key] = normalizeValue(key, value);
  }
  return next;
}

function withTableDefaults(table: string, row: Record<string, unknown>) {
  const next = { ...row };
  const now = new Date().toISOString();
  for (const column of TABLE_TIMESTAMP_DEFAULTS[table] || []) {
    if (next[column] == null || next[column] === "") {
      next[column] = now;
    }
  }
  return next;
}

function parseRow(row: Record<string, unknown>) {
  const next = fromMysqlRow(row);
  for (const key of JSON_COLUMNS) {
    const value = next[key];
    if (typeof value === "string") {
      try {
        next[key] = JSON.parse(value);
      } catch {
        next[key] = value;
      }
    }
  }
  for (const [key, value] of Object.entries(next)) {
    if (value === 0 && key.startsWith("is_")) next[key] = false;
    if (value === 1 && key.startsWith("is_")) next[key] = true;
    if (key === "free_granted" || key === "cancel_at_period_end") next[key] = Boolean(value);
  }
  return next;
}

function mysqlError(error: unknown) {
  const err = error as { message?: string; code?: string; errno?: number; sqlMessage?: string };
  const code = err?.errno === 1062 ? "23505" : err?.code;
  return new MysqlAdapterError(err?.sqlMessage || err?.message || "MySQL query failed.", code);
}

function buildWhere(filters: Filter[]) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  for (const filter of filters) {
    const column = quoteIdent(filter.column);
    if (filter.op === "is") {
      clauses.push(filter.value === null ? `${column} is null` : `${column} is not null`);
    } else if (filter.op === "in") {
      const values = Array.isArray(filter.value) ? filter.value : [];
      clauses.push(`${column} in (${values.map(() => "?").join(", ") || "null"})`);
      params.push(...values.map((value) => normalizeValue(filter.column, value)));
    } else {
      clauses.push(`${column} ${filter.op} ?`);
      params.push(normalizeValue(filter.column, filter.value));
    }
  }
  return { sql: clauses.length ? ` where ${clauses.join(" and ")}` : "", params };
}

export class MysqlQueryBuilder {
  private operation: "select" | "insert" | "update" | "delete" | "upsert" | null = null;
  private selectColumns = "*";
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitCount: number | null = null;
  private rangeValue: [number, number] | null = null;
  private body: Record<string, unknown>[] | null = null;
  private singleMode: "single" | "maybe" | null = null;
  private conflictColumns: string[] | null = null;
  private ignoreDuplicates = false;

  constructor(private table: string) {}

  select(columns?: string) {
    this.operation = this.operation || "select";
    this.selectColumns = normalizeSelectColumns(columns);
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.operation = "insert";
    this.body = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values: Record<string, unknown>) {
    this.operation = "update";
    this.body = [values];
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.operation = "upsert";
    this.body = Array.isArray(values) ? values : [values];
    this.conflictColumns = options?.onConflict?.split(",").map((x) => x.trim()).filter(Boolean) || TABLE_CONFLICT_KEYS[this.table] || ["id"];
    this.ignoreDuplicates = Boolean(options?.ignoreDuplicates);
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "=", value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, op: "<>", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, op: ">=", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, op: "<=", value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, op: "is", value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, op: "in", value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeValue = [from, to];
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  throwOnError() {
    return this.then((result) => {
      if (result.error) throw result.error;
      return result;
    });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult> {
    try {
      const operation = this.operation || "select";
      if (operation === "select") return await this.executeSelect();
      if (operation === "insert") return await this.executeInsert(false);
      if (operation === "upsert") return await this.executeInsert(true);
      if (operation === "update") return await this.executeUpdate();
      return await this.executeDelete();
    } catch (error) {
      return { data: null, error: mysqlError(error) };
    }
  }

  private async executeSelect(): Promise<QueryResult> {
    const where = buildWhere(this.filters);
    const orderSql = this.orders.length
      ? ` order by ${this.orders.map((order) => `${quoteIdent(order.column)} ${order.ascending ? "asc" : "desc"}`).join(", ")}`
      : "";
    const limit = this.rangeValue ? this.rangeValue[1] - this.rangeValue[0] + 1 : this.limitCount;
    const offset = this.rangeValue ? this.rangeValue[0] : null;
    const limitSql = limit != null ? ` limit ${Number(limit)}${offset != null ? ` offset ${Number(offset)}` : ""}` : "";
    const sql = `select ${this.selectColumns} from ${quoteIdent(this.table)}${where.sql}${orderSql}${limitSql}`;
    const rows = await mysqlExecute<RowDataPacket[]>(sql, where.params);
    const data = rows.map((row) => parseRow(row as Record<string, unknown>));
    if (this.singleMode) {
      if (!data.length && this.singleMode === "single") {
        return { data: null, error: new MysqlAdapterError("No rows returned.", "PGRST116") };
      }
      return { data: data[0] || null, error: null };
    }
    return { data, error: null };
  }

  private async executeInsert(upsert: boolean): Promise<QueryResult> {
    const rows = (this.body || []).map((row) => normalizeRow(withTableDefaults(this.table, row)));
    if (!rows.length) return { data: [], error: null };
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const values = rows.map((row) => columns.map((column) => row[column] ?? null));
    const placeholders = values.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    const updateSql = upsert
      ? this.ignoreDuplicates
        ? " on duplicate key update " + quoteIdent(this.conflictColumns?.[0] || columns[0]) + " = " + quoteIdent(this.conflictColumns?.[0] || columns[0])
        : " on duplicate key update " + columns.map((column) => `${quoteIdent(column)} = values(${quoteIdent(column)})`).join(", ")
      : "";
    const sql = `insert into ${quoteIdent(this.table)} (${columns.map(quoteIdent).join(", ")}) values ${placeholders}${updateSql}`;
    const result = await mysqlExecute<ResultSetHeader>(sql, values.flat());
    if (this.selectColumns !== "*" || this.singleMode) {
      const selected = await this.selectInserted(rows, columns);
      return selected;
    }
    return { data: { affectedRows: result.affectedRows }, error: null };
  }

  private async selectInserted(rows: Record<string, unknown>[], columns: string[]) {
    const keyColumns = this.conflictColumns || TABLE_CONFLICT_KEYS[this.table] || (columns.includes("id") ? ["id"] : columns.slice(0, 1));
    const selected = new MysqlQueryBuilder(this.table).select(this.selectColumns);
    for (const key of keyColumns) selected.eq(key, rows[0][key]);
    if (this.singleMode === "single") return selected.single().execute();
    if (this.singleMode === "maybe") return selected.maybeSingle().execute();
    return selected.execute();
  }

  private async executeUpdate(): Promise<QueryResult> {
    const row = normalizeRow((this.body || [])[0] || {});
    const columns = Object.keys(row);
    if (!columns.length) return { data: null, error: null };
    const where = buildWhere(this.filters);
    const sql = `update ${quoteIdent(this.table)} set ${columns.map((column) => `${quoteIdent(column)} = ?`).join(", ")}${where.sql}`;
    const result = await mysqlExecute<ResultSetHeader>(sql, [...columns.map((column) => row[column]), ...where.params]);
    return { data: { affectedRows: result.affectedRows }, error: null };
  }

  private async executeDelete(): Promise<QueryResult> {
    const where = buildWhere(this.filters);
    const sql = `delete from ${quoteIdent(this.table)}${where.sql}`;
    const result = await mysqlExecute<ResultSetHeader>(sql, where.params);
    return { data: { affectedRows: result.affectedRows }, error: null };
  }
}

async function applyCreditLedgerOnce(params: Record<string, unknown>) {
  return withMysqlTransaction(async (conn) => {
    const userId = String(params.p_user_id || "");
    const amount = Number(params.p_amount || 0);
    const reason = String(params.p_reason || "");
    const referenceId = params.p_reference_id == null ? null : String(params.p_reference_id);
    const allowNegative = Boolean(params.p_allow_negative);
    const now = new Date();

    const [existing] = await (conn as any).execute(
      "select id, amount from credit_ledger where user_id = ? and reason = ? and reference_id <=> ? limit 1",
      [userId, reason, referenceId]
    );
    const [accountRows] = await (conn as any).execute("select balance from user_credit_accounts where user_id = ? for update", [userId]);
    const currentBalance = Number(accountRows[0]?.balance || 0);
    if (existing.length) {
      return { balance: currentBalance, ledger_id: existing[0].id, duplicate: true, applied: false };
    }
    if (!allowNegative && currentBalance + amount < 0) {
      return { balance: currentBalance, ledger_id: null, duplicate: false, applied: false };
    }
    if (!accountRows.length) {
      await (conn as any).execute("insert into user_credit_accounts (user_id, balance, free_granted, created_at, updated_at) values (?, 0, 0, ?, ?)", [
        userId,
        toMysqlDate(now),
        toMysqlDate(now)
      ]);
    }
    const nextBalance = currentBalance + amount;
    await (conn as any).execute("update user_credit_accounts set balance = ?, updated_at = ? where user_id = ?", [nextBalance, toMysqlDate(now), userId]);
    const [inserted] = await (conn as any).execute(
      "insert into credit_ledger (user_id, amount, reason, reference_id, created_at) values (?, ?, ?, ?, ?)",
      [userId, amount, reason, referenceId, toMysqlDate(now)]
    );
    return { balance: nextBalance, ledger_id: inserted.insertId, duplicate: false, applied: true };
  });
}

async function getModelDailyUsage(params: Record<string, unknown>) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await mysqlExecute<RowDataPacket[]>(
    "select coalesce(sum(units), 0) as used_units from model_daily_usage_events where user_id = ? and model_key = ? and usage_date = ? and refunded_at is null",
    [params.p_user_id, params.p_model_key, today]
  );
  return { used_units: Number(rows[0]?.used_units || 0) };
}

async function reserveModelDailyUnits(params: Record<string, unknown>) {
  return withMysqlTransaction(async (conn: PoolConnection) => {
    const userId = String(params.p_user_id || "");
    const modelKey = String(params.p_model_key || "");
    const referenceId = String(params.p_reference_id || "");
    const units = Number(params.p_units || 0);
    const dailyLimit = Number(params.p_daily_limit || 0);
    const today = new Date().toISOString().slice(0, 10);
    const now = toMysqlDate(new Date());

    const [existing] = await (conn as any).execute(
      "select id from model_daily_usage_events where user_id = ? and model_key = ? and reference_id = ? limit 1",
      [userId, modelKey, referenceId]
    );
    const [usageRows] = await (conn as any).execute(
      "select coalesce(sum(units), 0) as used_units from model_daily_usage_events where user_id = ? and model_key = ? and usage_date = ? and refunded_at is null for update",
      [userId, modelKey, today]
    );
    const used = Number(usageRows[0]?.used_units || 0);
    if (existing.length) {
      return { allowed: true, duplicate: true, used_units: used, remaining_units: Math.max(0, dailyLimit - used) };
    }
    if (used + units > dailyLimit) {
      return { allowed: false, duplicate: false, used_units: used, remaining_units: Math.max(0, dailyLimit - used) };
    }
    await (conn as any).execute(
      "insert into model_daily_usage_events (user_id, model_key, usage_date, units, reference_id, created_at) values (?, ?, ?, ?, ?, ?)",
      [userId, modelKey, today, units, referenceId, now]
    );
    const next = used + units;
    return { allowed: true, duplicate: false, used_units: next, remaining_units: Math.max(0, dailyLimit - next) };
  });
}

async function refundModelDailyUnits(params: Record<string, unknown>) {
  await mysqlExecute(
    "update model_daily_usage_events set refunded_at = ? where user_id = ? and model_key = ? and reference_id = ? and refunded_at is null",
    [toMysqlDate(new Date()), params.p_user_id, params.p_model_key, params.p_reference_id]
  );
  return null;
}

class MysqlStorageBucket {
  constructor(private bucket: string) {}

  async upload(objectPath: string, bytes: Buffer, _options?: { contentType?: string; upsert?: boolean }) {
    try {
      const target = path.join(process.cwd(), "public", "uploads", this.bucket, objectPath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
      return { data: { path: objectPath }, error: null };
    } catch (error) {
      return { data: null, error: mysqlError(error) };
    }
  }

  getPublicUrl(objectPath: string) {
    return { data: { publicUrl: `${siteUrl()}/uploads/${this.bucket}/${objectPath.replace(/\\/g, "/")}` } };
  }

  async remove(paths: string[]) {
    for (const objectPath of paths) {
      const target = path.join(process.cwd(), "public", "uploads", this.bucket, objectPath);
      await rm(target, { force: true }).catch(() => null);
    }
    return { data: paths, error: null };
  }
}

export function createMysqlSupabaseAdapter() {
  return {
    from(table: string) {
      return new MysqlQueryBuilder(table);
    },
    async rpc(name: string, params: Record<string, unknown>) {
      try {
        if (name === "apply_credit_ledger_once") return { data: await applyCreditLedgerOnce(params), error: null };
        if (name === "get_model_daily_usage") return { data: await getModelDailyUsage(params), error: null };
        if (name === "reserve_model_daily_units") return { data: await reserveModelDailyUnits(params), error: null };
        if (name === "refund_model_daily_units") return { data: await refundModelDailyUnits(params), error: null };
        return { data: null, error: new MysqlAdapterError(`Unsupported RPC: ${name}`) };
      } catch (error) {
        return { data: null, error: mysqlError(error) };
      }
    },
    storage: {
      from(bucket: string) {
        return new MysqlStorageBucket(bucket);
      }
    },
    auth: {
      admin: {
        async listUsers(options?: { page?: number; perPage?: number }) {
          const page = Math.max(1, Number(options?.page || 1));
          const perPage = Math.max(1, Number(options?.perPage || 50));
          const offset = (page - 1) * perPage;
          const rows = await mysqlExecute<RowDataPacket[]>(
            "select id, email, created_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data from users order by created_at desc limit ? offset ?",
            [perPage, offset]
          );
          return { data: { users: rows.map((row) => parseRow(row as Record<string, unknown>)) }, error: null };
        }
      }
    }
  };
}

export type MysqlSupabaseAdapter = ReturnType<typeof createMysqlSupabaseAdapter>;
