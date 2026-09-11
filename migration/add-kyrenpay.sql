-- Run after mysql-schema.sql / add-payment-providers.sql. Safe to rerun.
-- Existing purchases, subscriptions and credit balances are preserved.
CREATE TABLE IF NOT EXISTS kyren_checkouts (
  reference_id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  pack_id VARCHAR(128) NOT NULL,
  product_id VARCHAR(128) NOT NULL,
  credits INT NOT NULL,
  amount_cents INT NOT NULL,
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  checkout_id VARCHAR(128) NULL,
  order_id VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'creating',
  checked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY kyren_checkout_unique (checkout_id),
  UNIQUE KEY kyren_order_unique (order_id),
  KEY kyren_reconcile_idx (status, checked_at),
  KEY kyren_user_idx (user_id, created_at),
  CONSTRAINT kyren_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
