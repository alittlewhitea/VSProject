import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

loadEnvFile(path.join(__dirname, ".env.local"));
loadEnvFile(path.join(rootDir, ".env.local"));

const batchSize = Math.max(1, Number.parseInt(process.env.IMPORT_BATCH_SIZE || "100", 10));
const csvDir = path.resolve(rootDir, process.env.CSV_DIR || "migration/supabase-csv");

const tables = [
  {
    csv: "auth_users_rows.csv",
    table: "users",
    columns: ["id", "email", "phone", "created_at", "updated_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data"],
    transform(row) {
      const appMeta = parseJson(row.raw_app_meta_data);
      const userMeta = parseJson(row.raw_user_meta_data);
      return {
        ...row,
        phone: nullable(row.phone),
        raw_app_meta_data: jsonValue(appMeta),
        raw_user_meta_data: jsonValue(userMeta),
        provider: appMeta?.provider || null,
        google_sub: userMeta?.provider_id || userMeta?.sub || null,
        avatar_url: userMeta?.avatar_url || userMeta?.picture || null,
        full_name: userMeta?.full_name || userMeta?.name || null
      };
    },
    insertColumns: ["id", "email", "phone", "created_at", "updated_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "provider", "google_sub", "avatar_url", "full_name"]
  },
  {
    csv: "auth_identities_rows.csv",
    table: "user_identities",
    columns: ["id", "user_id", "provider", "provider_id", "identity_data", "created_at", "updated_at", "last_sign_in_at"],
    transform(row) {
      return { ...row, identity_data: jsonValue(parseJson(row.identity_data)) };
    }
  },
  {
    csv: "user_credit_accounts_rows.csv",
    table: "user_credit_accounts",
    columns: ["user_id", "balance", "free_granted", "created_at", "updated_at"],
    transform(row) {
      return { ...row, balance: intValue(row.balance), free_granted: boolValue(row.free_granted) };
    }
  },
  {
    csv: "generation_tasks_rows.csv",
    table: "generation_tasks",
    columns: ["id", "user_id", "mode", "provider", "prompt", "status", "estimated_credits", "transport", "status_url", "response_url", "output_url", "raw_result", "created_at", "title", "is_favorite", "deleted_at", "updated_at", "failure_code", "failure_reason", "last_checked_at", "timed_out_at", "provider_request_id", "request_settings"],
    transform(row) {
      return {
        ...row,
        estimated_credits: intValue(row.estimated_credits),
        raw_result: jsonValue(parseJson(row.raw_result)),
        request_settings: jsonValue(parseJson(row.request_settings) || {}),
        is_favorite: boolValue(row.is_favorite)
      };
    }
  },
  {
    csv: "credit_ledger_rows.csv",
    table: "credit_ledger",
    columns: ["id", "user_id", "amount", "reason", "reference_id", "created_at"],
    transform(row) {
      return { ...row, id: intValue(row.id), amount: intValue(row.amount) };
    }
  },
  {
    csv: "credit_purchases_rows.csv",
    table: "credit_purchases",
    columns: ["id", "user_id", "stripe_checkout_id", "pack_id", "credits", "amount_cents", "currency", "status", "created_at", "updated_at"],
    transform(row) {
      return { ...row, id: intValue(row.id), credits: intValue(row.credits), amount_cents: intValue(row.amount_cents) };
    }
  },
  {
    csv: "user_subscriptions_rows.csv",
    table: "user_subscriptions",
    columns: ["id", "user_id", "stripe_customer_id", "stripe_subscription_id", "plan_id", "cycle", "credits_per_cycle", "status", "cancel_at_period_end", "current_period_start", "current_period_end", "canceled_at", "created_at", "updated_at"],
    transform(row) {
      return { ...row, id: intValue(row.id), credits_per_cycle: intValue(row.credits_per_cycle), cancel_at_period_end: boolValue(row.cancel_at_period_end) };
    }
  },
  {
    csv: "model_daily_usage_events_rows.csv",
    table: "model_daily_usage_events",
    columns: ["id", "user_id", "model_key", "usage_date", "units", "reference_id", "refunded_at", "created_at"],
    transform(row) {
      return { ...row, id: intValue(row.id), units: intValue(row.units) };
    }
  },
  {
    csv: "signup_ip_claims_rows.csv",
    table: "signup_ip_claims",
    columns: ["ip_hash", "user_id", "created_at"]
  },
  {
    csv: "analytics_events_rows.csv",
    table: "analytics_events",
    columns: ["id", "user_id", "anonymous_id", "session_id", "event_name", "event_source", "page_path", "referrer", "user_agent", "ip_hash", "properties", "created_at"],
    transform(row) {
      return { ...row, properties: jsonValue(parseJson(row.properties) || {}) };
    }
  },
  {
    csv: "public_gallery_items_rows.csv",
    table: "public_gallery_items",
    columns: ["id", "title", "category", "image_url", "thumbnail_url", "prompt", "model", "author_name", "author_handle", "source_platform", "source_url", "aspect_ratio", "width", "height", "is_featured", "is_published", "published_at", "created_at"],
    transform(row) {
      return {
        ...row,
        width: intValue(row.width),
        height: intValue(row.height),
        is_featured: boolValue(row.is_featured),
        is_published: boolValue(row.is_published)
      };
    }
  }
];

async function main() {
  const mysql = await importMysql();
  const connection = await mysql.createConnection({
    host: requiredEnv("MYSQL_HOST"),
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
    database: requiredEnv("MYSQL_DATABASE"),
    user: requiredEnv("MYSQL_USER"),
    password: requiredEnv("MYSQL_PASSWORD"),
    charset: "utf8mb4",
    multipleStatements: false,
    ssl: process.env.MYSQL_SSL === "true" ? {} : undefined
  });

  await connection.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'");
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");

  try {
    for (const table of tables) {
      await importTable(connection, table);
    }
  } finally {
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    await connection.end();
  }

  console.log("Import complete.");
}

async function importTable(connection, table) {
  const file = path.join(csvDir, table.csv);
  if (!fs.existsSync(file)) {
    console.log(`Skip ${table.csv}: file not found.`);
    return;
  }

  const insertColumns = table.insertColumns || table.columns;
  const escapedColumns = insertColumns.map((column) => `\`${column}\``).join(", ");
  const sql = `INSERT INTO \`${table.table}\` (${escapedColumns}) VALUES ?`;
  let batch = [];
  let count = 0;

  console.log(`Importing ${table.csv} -> ${table.table}`);
  for await (const row of readCsvObjects(file)) {
    const transformed = normalizeRow(table.transform ? table.transform(row) : row);
    batch.push(insertColumns.map((column) => transformed[column] ?? null));
    if (batch.length >= batchSize) {
      await insertBatch(connection, sql, batch);
      count += batch.length;
      batch = [];
      process.stdout.write(`\r  ${count.toLocaleString()} rows`);
    }
  }

  if (batch.length) {
    await insertBatch(connection, sql, batch);
    count += batch.length;
  }

  console.log(`\r  ${count.toLocaleString()} rows imported into ${table.table}.`);
}

async function insertBatch(connection, sql, batch) {
  await connection.beginTransaction();
  try {
    await connection.query(sql, [batch]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function* readCsvObjects(file) {
  let headers = null;
  for await (const record of parseCsv(file)) {
    if (!headers) {
      headers = record;
      continue;
    }
    const row = {};
    headers.forEach((header, index) => {
      row[header] = record[index] ?? "";
    });
    yield row;
  }
}

async function* parseCsv(file) {
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  let field = "";
  let row = [];
  let quoted = false;

  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i += 1) {
      const char = chunk[i];
      const next = chunk[i + 1];

      if (quoted) {
        if (char === '"' && next === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(stripCr(field));
        field = "";
        yield row;
        row = [];
      } else {
        field += char;
      }
    }
  }

  if (field.length || row.length) {
    row.push(stripCr(field));
    yield row;
  }
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])
  );
}

function normalizeValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.replace(/\+00$/, "").replace(/(\.\d{6})\d+/, "$1");
  }
  return value;
}

function stripCr(value) {
  return value.endsWith("\r") ? value.slice(0, -1) : value;
}

function nullable(value) {
  return normalizeValue(value);
}

function intValue(value) {
  const normalized = normalizeValue(value);
  if (normalized === null) return null;
  const parsed = Number.parseInt(String(normalized), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolValue(value) {
  const normalized = normalizeValue(value);
  if (normalized === null) return 0;
  return ["true", "t", "1", "yes"].includes(String(normalized).toLowerCase()) ? 1 : 0;
}

function parseJson(value) {
  const normalized = normalizeValue(value);
  if (normalized === null) return null;
  try {
    return JSON.parse(String(normalized));
  } catch {
    return null;
  }
}

function jsonValue(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? {});
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function importMysql() {
  try {
    return await import("mysql2/promise");
  } catch {
    throw new Error("Missing dependency mysql2. Run: npm install mysql2");
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}. Copy migration/.env.example to migration/.env.local and fill it.`);
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
