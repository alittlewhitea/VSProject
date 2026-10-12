-- MySQL 5.7+ / InnoDB. Run on the existing DreamFace database before enabling Dodo.
-- Existing payment-provider migration, credit ledger unique index and payment
-- incident/webhook tables must already exist (as they do for PayPal).
-- Safe to rerun. No historical orders or balances are changed.
create table if not exists dodo_credit_checkouts (
  checkout_id char(36) character set ascii collate ascii_bin primary key,
  purchase_id bigint not null,
  session_id varchar(255) character set ascii collate ascii_bin null,
  product_id varchar(255) character set ascii collate ascii_bin not null,
  environment varchar(16) not null,
  paid_total_cents int null,
  paid_tax_cents int null,
  created_at datetime(6) not null,
  updated_at datetime(6) not null,
  unique key dodo_credit_checkout_purchase_unique (purchase_id),
  unique key dodo_credit_checkout_session_unique (session_id),
  key dodo_credit_checkout_created_idx (created_at),
  constraint dodo_credit_checkout_purchase_fk foreign key (purchase_id)
    references credit_purchases(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
