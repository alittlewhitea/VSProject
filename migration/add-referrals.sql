-- Additive migration. Back up first. Does not grant credits or change existing balances.
CREATE TABLE IF NOT EXISTS referral_settings (
  id INT PRIMARY KEY,
  enabled TINYINT NOT NULL DEFAULT 0,
  inviter_credits INT NOT NULL DEFAULT 100,
  invitee_credits INT NOT NULL DEFAULT 100,
  daily_limit INT NOT NULL DEFAULT 3,
  monthly_limit INT NOT NULL DEFAULT 30,
  daily_budget INT NOT NULL DEFAULT 10000,
  launched_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO referral_settings (id,launched_at) VALUES (1,UTC_TIMESTAMP(6));

CREATE TABLE IF NOT EXISTS referral_profiles (
  user_id CHAR(36) PRIMARY KEY,
  code CHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  email_verified VARCHAR(320) NULL,
  ip_excluded TINYINT NOT NULL DEFAULT 0,
  blocked TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referral_auth_contexts (
  auth_key CHAR(64) PRIMARY KEY,
  code CHAR(24) NULL,
  device_hash CHAR(64) NOT NULL,
  client_hash CHAR(64) NULL,
  ip_excluded TINYINT NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  KEY referral_auth_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referral_devices (
  device_hash CHAR(64) PRIMARY KEY,
  blocked_until DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS referral_device_users (
  device_hash CHAR(64) NOT NULL,
  user_id CHAR(36) NOT NULL,
  last_seen_at DATETIME(6) NOT NULL,
  PRIMARY KEY (device_hash,user_id),
  KEY referral_device_user (user_id),
  KEY referral_device_seen (device_hash,last_seen_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referrals (
  id CHAR(36) PRIMARY KEY,
  inviter_id CHAR(36) NOT NULL,
  invitee_id CHAR(36) NOT NULL UNIQUE,
  status VARCHAR(24) NOT NULL DEFAULT 'waiting',
  reason VARCHAR(64) NULL,
  inviter_credits INT NOT NULL,
  invitee_credits INT NOT NULL,
  bound_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  eligible_at DATETIME(6) NULL,
  due_at DATETIME(6) NULL,
  quota_day CHAR(10) NULL,
  quota_month CHAR(7) NULL,
  paid_at DATETIME(6) NULL,
  review_approved TINYINT NOT NULL DEFAULT 0,
  checked_at DATETIME(6) NOT NULL,
  KEY referral_inviter_quota (inviter_id,quota_day,quota_month,status),
  KEY referral_worker (status,checked_at),
  FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS referral_client_signals (
  client_hash CHAR(64) NOT NULL,
  user_id CHAR(36) NOT NULL,
  last_seen_at DATETIME(6) NOT NULL,
  PRIMARY KEY (client_hash,user_id),
  KEY referral_client_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS referral_device_claims (
  device_hash CHAR(64) PRIMARY KEY,
  referral_id CHAR(36) NOT NULL,
  created_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS referral_audit (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  referral_id CHAR(36) NULL,
  actor VARCHAR(320) NOT NULL,
  action VARCHAR(64) NOT NULL,
  note VARCHAR(1000) NULL,
  created_at DATETIME(6) NOT NULL,
  KEY referral_audit_lookup (referral_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
