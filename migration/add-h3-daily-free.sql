-- Additive migration; no changes to balances or historical signup bonuses.
-- Identity ownership is permanent while this promotion runs, not reset daily.
CREATE TABLE IF NOT EXISTS h3_daily_free_identities (
  identity_kind VARCHAR(8) NOT NULL,
  identity_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  owner_user_id CHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (identity_kind, identity_hash),
  KEY h3_free_identity_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS h3_daily_free_usage (
  quota_day DATE NOT NULL,
  user_id CHAR(36) NOT NULL,
  task_id VARCHAR(191) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (quota_day, user_id),
  UNIQUE KEY h3_free_task (task_id),
  KEY h3_free_user_day (user_id, quota_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
