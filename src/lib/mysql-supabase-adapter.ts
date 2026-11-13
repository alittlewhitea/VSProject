import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { fromMysqlRow, mysqlExecute, toMysqlDate, withMysqlTransaction } from "./mysql";
import { siteUrl } from "./site-url";
import { assertGenerationCapacity, GenerationCapacityError } from "./generation-capacity";
import {hasProviderIntegration} from "./retired-providers";

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
  "refunded_at",
  "resolved_at"
]);

const TABLE_CONFLICT_KEYS: Record<string, string[]> = {
  users: ["id"],
  user_identities: ["id"],
  user_credit_accounts: ["user_id"],
  signup_ip_claims: ["ip_hash"],
  runtime_settings: ["key"],
  payment_webhook_events: ["payment_provider", "event_id"],
  payment_incidents: ["payment_provider", "event_id"],
  credit_purchases: ["payment_provider", "provider_transaction_id"],
  user_subscriptions: ["payment_provider", "provider_subscription_id"],
  public_gallery_items: ["id"],
  generation_tasks: ["id"],
  analytics_events: ["id"]
};

const TABLE_TIMESTAMP_DEFAULTS: Record<string, string[]> = {
  analytics_events: ["created_at"],
  credit_ledger: ["created_at"],
  credit_purchases: ["created_at", "updated_at"],
  generation_tasks: ["created_at", "updated_at"],
  public_gallery_items: ["published_at", "created_at"],
  signup_ip_claims: ["created_at"],
  user_credit_accounts: ["created_at", "updated_at"],
  user_subscriptions: ["created_at", "updated_at"],
  payment_incidents: ["created_at", "updated_at"]
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
  for (const key of DATE_COLUMNS) {
    const value = next[key];
    if (typeof value === "string" && value) {
      const normalized = value.includes("T") ? value : value.replace(" ", "T");
      next[key] = /(?:Z|[+-]\d\d:\d\d)$/.test(normalized) ? normalized : `${normalized}Z`;
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
  private hasSelect = false;

  constructor(private table: string) {}

  select(columns?: string) {
    this.operation = this.operation || "select";
    this.hasSelect = true;
    // Keep the requested fields intact when insert/upsert readback builds a
    // second query. Quote identifiers only when producing the final SQL.
    this.selectColumns = columns || "*";
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
      if (operation === "delete") return await this.executeDelete();
      throw new MysqlAdapterError("Unsupported database operation.");
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
    const sql = `select ${normalizeSelectColumns(this.selectColumns)} from ${quoteIdent(this.table)}${where.sql}${orderSql}${limitSql}`;
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
    const keyColumns = this.conflictColumns || TABLE_CONFLICT_KEYS[this.table] || (columns.includes("id") ? ["id"] : null);
    if (!keyColumns?.length || keyColumns.some(key => rows[0][key] == null)) throw new MysqlAdapterError("An explicit row key is required to read inserted data.");
    const selected = new MysqlQueryBuilder(this.table).select(this.selectColumns);
    for (const key of keyColumns) selected.eq(key, rows[0][key]);
    if (this.singleMode === "single") return selected.single().execute();
    if (this.singleMode === "maybe") return selected.maybeSingle().execute();
    return selected.execute();
  }

  private async executeUpdate(): Promise<QueryResult> {
    if (!this.filters.length) throw new MysqlAdapterError("Refusing an unfiltered UPDATE.");
    const row = normalizeRow((this.body || [])[0] || {});
    const columns = Object.keys(row);
    if (!columns.length) return { data: null, error: null };
    const where = buildWhere(this.filters);
    const sql = `update ${quoteIdent(this.table)} set ${columns.map((column) => `${quoteIdent(column)} = ?`).join(", ")}${where.sql}`;
    const result = await mysqlExecute<ResultSetHeader>(sql, [...columns.map((column) => row[column]), ...where.params]);
    if (this.hasSelect || this.singleMode) {
      return this.executeSelect();
    }
    return { data: { affectedRows: result.affectedRows }, error: null };
  }

  private async executeDelete(): Promise<QueryResult> {
    if (!this.filters.length) throw new MysqlAdapterError("Refusing an unfiltered DELETE.");
    const where = buildWhere(this.filters);
    const sql = `delete from ${quoteIdent(this.table)}${where.sql}`;
    const result = await mysqlExecute<ResultSetHeader>(sql, where.params);
    return { data: { affectedRows: result.affectedRows }, error: null };
  }
}

async function applyCreditLedgerOnce(params: Record<string, unknown>, connection?: PoolConnection) {
  const apply = async (conn: PoolConnection) => {
    const userId = String(params.p_user_id || "");
    const amount = Number(params.p_amount || 0);
    const reason = String(params.p_reason || "");
    const referenceId = params.p_reference_id == null ? null : String(params.p_reference_id);
    const allowNegative = Boolean(params.p_allow_negative);
    const now = new Date();

    const [accountRows] = await (conn as any).execute("select balance from user_credit_accounts where user_id = ? for update", [userId]);
    const currentBalance = Number(accountRows[0]?.balance || 0);
    const [existing] = await (conn as any).execute(
      "select id, amount from credit_ledger where user_id = ? and reason = ? and reference_id <=> ? limit 1",
      [userId, reason, referenceId]
    );
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
  };
  return connection ? apply(connection) : withMysqlTransaction(apply);
}

const TASK_SETTLEMENT_COLUMNS = new Set(["status", "response_url", "status_url", "provider_request_id", "output_url", "raw_result", "failure_code", "failure_reason", "last_checked_at", "timed_out_at", "updated_at"]);

async function reserveGenerationTask(params: Record<string, unknown>) {
  const task = params.p_task as Record<string, unknown>;
  if (!task || !task.id || !task.user_id || !["image", "video", "audio"].includes(String(task.mode)) || !["real", "mock"].includes(String(task.transport)) || typeof task.prompt !== "string" || typeof task.provider !== "string" || !Number.isSafeInteger(task.estimated_credits) || Number(task.estimated_credits) < 0) throw new MysqlAdapterError("Invalid generation reservation.");
  try {
    return await withMysqlTransaction(async conn => {
      const [accounts] = await conn.execute<RowDataPacket[]>("select balance from user_credit_accounts where user_id = ? for update", [String(task.user_id)]);
      if (!accounts.length) throw new MysqlAdapterError("Generation account is unavailable.");
      const balance = Number(accounts[0].balance);
      const [existing] = await conn.execute<RowDataPacket[]>("select * from generation_tasks where id = ? and user_id = ?", [String(task.id), String(task.user_id)]);
      if (existing.length) return { allowed: true, duplicate: true, balance, task: parseRow(existing[0]) };
      await assertGenerationCapacity(conn, String(task.user_id));
      if (balance < Number(task.estimated_credits)) return { allowed: false, duplicate: false, balance, task: null };
      const row = normalizeRow(withTableDefaults("generation_tasks", { id:task.id, user_id:task.user_id, mode:task.mode, provider:task.provider, prompt:task.prompt, estimated_credits:task.estimated_credits, transport:task.transport, request_settings:task.request_settings || {}, status:"queued" }));
      const columns = Object.keys(row);
      await conn.execute(`insert into generation_tasks (${columns.map(quoteIdent).join(",")}) values (${columns.map(() => "?").join(",")})`, columns.map(key => row[key]) as any[]);
      const charge = Number(task.estimated_credits) > 0
        ? await applyCreditLedgerOnce({p_user_id:task.user_id, p_amount:-Number(task.estimated_credits), p_reason:"generation_task", p_reference_id:task.id}, conn)
        : {balance};
      return { allowed:true, duplicate:false, balance:charge.balance, task:parseRow(row) };
    });
  } catch (error) {
    if (error instanceof GenerationCapacityError) throw new MysqlAdapterError(error.message, "generation_concurrency_limit");
    throw error;
  }
}

async function settleGenerationTask(params: Record<string, unknown>) {
  const userId = String(params.p_user_id || ""), taskId = String(params.p_task_id || "");
  const patch = params.p_patch as Record<string, unknown>;
  if (!userId || !taskId || !patch || !["queued", "running", "completed", "failed"].includes(String(patch.status))) throw new MysqlAdapterError("Invalid task settlement.");
  if (Object.keys(patch).some(key => !TASK_SETTLEMENT_COLUMNS.has(key))) throw new MysqlAdapterError("Unsupported task settlement field.");
  return withMysqlTransaction(async conn => {
    const [tasks] = await conn.execute<RowDataPacket[]>("select * from generation_tasks where id = ? and user_id = ? for update", [taskId, userId]);
    const task = tasks[0];
    if (!task) throw new MysqlAdapterError("Task not found.");
    const repairingFailedRefund = params.p_repair_failed_refund === true && task.status === "failed" && patch.status === "failed";
    if (!["queued", "running"].includes(String(task.status)) && !repairingFailedRefund) return { applied: false, task: parseRow(task), balance: null, refundLedgerId: null, refundedCredits: 0 };
    const resolution=params.p_resolution as Record<string,unknown>|undefined;
    if(resolution&&(!resolution.actor||typeof resolution.note!=="string"||resolution.note.length<12||typeof resolution.evidence!=="string"))throw new MysqlAdapterError("A documented operator resolution is required.");
    const config=parseRow(task).request_settings as Record<string,any> || {};
    if(resolution?.evidence==="operator_provider_confirmed_no_active_job") {
      if(task.provider_request_id&&hasProviderIntegration(task.provider))throw new MysqlAdapterError("Provider tracking arrived while this task was being reviewed. Reconcile it first.");
      const latest=Math.max(0,...Object.values(config.provider_attempts||{}).map((attempt:any)=>new Date(attempt?.startedAt||0).getTime()).filter(Number.isFinite));
      if(latest&&Date.now()-latest<10*60000)throw new MysqlAdapterError("A recent provider stage is still awaiting confirmation.");
    }
    const normalized = normalizeRow({ ...patch, status: task.status === "running" && patch.status === "queued" ? "running" : patch.status,
      ...(resolution?{request_settings:{...config,reconciliation_events:[...(Array.isArray(config.reconciliation_events)?config.reconciliation_events:[]),{action:"settle",...resolution,at:new Date().toISOString()}].slice(-20)}}:{}) });
    const columns = Object.keys(normalized);
    await conn.execute(`update generation_tasks set ${columns.map(column => `${quoteIdent(column)} = ?`).join(", ")} where id = ? and user_id = ?`, [...columns.map(column => normalized[column]), taskId, userId] as any[]);
    let balance: number | null = null, refundLedgerId: number | string | null = null, refundedCredits = 0;
    const requested = Number(params.p_refund_credits || 0);
    if (!Number.isSafeInteger(requested) || requested < 0) throw new MysqlAdapterError("Invalid task refund.");
    if (requested && patch.status !== "failed") throw new MysqlAdapterError("Only a failed task can be refunded.");
    if (requested) {
      const [charges] = await conn.execute<RowDataPacket[]>("select amount from credit_ledger where user_id = ? and reason = 'generation_task' and reference_id = ? limit 1", [userId, taskId]);
      const charged = Math.max(0, -Number(charges[0]?.amount || 0));
      const amount = Math.min(requested, charged, Math.max(0, Number(task.estimated_credits || 0)));
      if (amount) {
        const credit = await applyCreditLedgerOnce({ p_user_id: userId, p_amount: amount, p_reason: "generation_refund", p_reference_id: taskId, p_allow_negative: false }, conn);
        balance = credit.balance; refundLedgerId = credit.ledger_id; refundedCredits = credit.duplicate ? 0 : amount;
      }
    }
    return { applied: true, task: parseRow({ ...task, ...normalized }), balance, refundLedgerId, refundedCredits };
  });
}

class MysqlStorageBucket {
  constructor(private bucket: string) {}

  private storageRoot() {
    return path.join(process.cwd(), ".data", "uploads", this.bucket);
  }

  async upload(objectPath: string, bytes: Buffer, _options?: { contentType?: string; upsert?: boolean }) {
    try {
      const target = path.join(this.storageRoot(), objectPath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
      return { data: { path: objectPath }, error: null };
    } catch (error) {
      return { data: null, error: mysqlError(error) };
    }
  }

  getPublicUrl(objectPath: string) {
    return { data: { publicUrl: `${siteUrl()}/api/uploads/${this.bucket}/${objectPath.replace(/\\/g, "/")}` } };
  }

  async remove(paths: string[]) {
    for (const objectPath of paths) {
      const target = path.join(this.storageRoot(), objectPath);
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
        if (name === "settle_generation_task") return { data: await settleGenerationTask(params), error: null };
        if (name === "reserve_generation_task") return { data: await reserveGenerationTask(params), error: null };
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
