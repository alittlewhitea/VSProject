# Supabase CSV to MySQL Migration

These files are migration helpers only. They do not change the live app until the app code is later switched from Supabase to MySQL.

## 1. Files

Put Supabase CSV exports in:

```text
migration/supabase-csv
```

Expected CSV files:

```text
auth_users_rows.csv
auth_identities_rows.csv
generation_tasks_rows.csv
user_subscriptions_rows.csv
user_credit_accounts_rows.csv
signup_ip_claims_rows.csv
public_gallery_items_rows.csv
model_daily_usage_events_rows.csv
credit_ledger_rows.csv
credit_purchases_rows.csv
analytics_events_rows.csv
```

`runtime_settings` is empty in the current export, so no CSV is required for it.

## 2. Create MySQL Tables

In BT Panel / phpMyAdmin, select the empty MySQL database and run:

```sql
source migration/mysql-schema.sql;
```

If phpMyAdmin cannot use `source`, open `migration/mysql-schema.sql`, paste it into SQL, and execute.

## 3. Configure Import

Copy:

```text
migration/.env.example
```

to:

```text
migration/.env.local
```

Fill:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=dreamface
MYSQL_USER=dreamface
MYSQL_PASSWORD=your_password
MYSQL_SSL=false
CSV_DIR=./migration/supabase-csv
IMPORT_BATCH_SIZE=500
```

Use `MYSQL_HOST=127.0.0.1` when Next.js/import script runs on the same BT server as MySQL. Use the server IP only when importing remotely and MySQL remote access is allowed.

## 4. Install Import Dependency

The import script uses `mysql2`:

```bash
npm install mysql2
```

## 5. Run Import

```bash
node migration/import-supabase-csv.mjs
```

The large `generation_tasks_rows.csv` is streamed and imported in batches.

## 6. Verify Counts

Run in MySQL:

```sql
select count(*) from users;
select count(*) from user_identities;
select count(*) from generation_tasks;
select count(*) from user_credit_accounts;
select count(*) from credit_ledger;
select count(*) from credit_purchases;
select count(*) from user_subscriptions;
select count(*) from public_gallery_items;
select count(*) from model_daily_usage_events;
select count(*) from signup_ip_claims;
select count(*) from analytics_events;
```

Compare with the Supabase CSV row counts.

## 7. Important

Do not switch production environment variables until:

- MySQL row counts match the CSV exports.
- Email login and Google login are rebuilt against local MySQL users/sessions.
- Credit spend/refund transaction logic is implemented in MySQL.
- Stripe webhooks are updated to write to MySQL.
- Generation task creation/status sync is updated to write to MySQL.
