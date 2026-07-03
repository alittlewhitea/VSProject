-- DreamFace Supabase -> MySQL schema
-- Run this against an empty MySQL 8+ database before importing CSV data.

set names utf8mb4;

create table if not exists users (
  id char(36) primary key,
  email varchar(320),
  phone varchar(64),
  created_at datetime(6) null,
  updated_at datetime(6) null,
  last_sign_in_at datetime(6) null,
  raw_app_meta_data json null,
  raw_user_meta_data json null,
  provider varchar(64),
  google_sub varchar(191),
  avatar_url text,
  full_name varchar(255),
  unique key users_email_unique (email),
  key users_google_sub_idx (google_sub)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists user_identities (
  id varchar(191) primary key,
  user_id char(36) not null,
  provider varchar(64) not null,
  provider_id varchar(191),
  identity_data json null,
  created_at datetime(6) null,
  updated_at datetime(6) null,
  last_sign_in_at datetime(6) null,
  unique key user_identities_provider_provider_id_unique (provider, provider_id),
  key user_identities_user_id_idx (user_id),
  constraint user_identities_user_id_fk foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists sessions (
  id char(64) primary key,
  user_id char(36) not null,
  expires_at datetime(6) not null,
  created_at datetime(6) not null default current_timestamp(6),
  key sessions_user_id_idx (user_id),
  key sessions_expires_at_idx (expires_at),
  constraint sessions_user_id_fk foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists email_otp_codes (
  id bigint primary key auto_increment,
  email varchar(320) not null,
  code_hash char(64) not null,
  expires_at datetime(6) not null,
  consumed_at datetime(6) null,
  created_at datetime(6) not null default current_timestamp(6),
  key email_otp_codes_email_created_at_idx (email, created_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists generation_tasks (
  id varchar(191) primary key,
  user_id char(36) not null,
  mode enum('image', 'video', 'audio') not null,
  provider varchar(128) not null,
  prompt longtext not null,
  status enum('queued', 'running', 'completed', 'failed') not null,
  estimated_credits int not null default 0,
  transport enum('real', 'mock') not null,
  status_url text,
  response_url text,
  output_url text,
  raw_result json null,
  request_settings json not null,
  provider_request_id text,
  title text,
  is_favorite tinyint(1) not null default 0,
  failure_code text,
  failure_reason text,
  last_checked_at datetime(6) null,
  timed_out_at datetime(6) null,
  deleted_at datetime(6) null,
  created_at datetime(6) not null,
  updated_at datetime(6) not null,
  key generation_tasks_user_created_idx (user_id, created_at),
  key generation_tasks_user_deleted_created_idx (user_id, deleted_at, created_at),
  key generation_tasks_user_favorite_created_idx (user_id, is_favorite, created_at),
  key generation_tasks_status_created_idx (status, created_at),
  constraint generation_tasks_user_id_fk foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists user_credit_accounts (
  user_id char(36) primary key,
  balance int not null default 0,
  free_granted tinyint(1) not null default 0,
  created_at datetime(6) not null,
  updated_at datetime(6) not null,
  constraint user_credit_accounts_user_id_fk foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists signup_ip_claims (
  ip_hash varchar(191) primary key,
  user_id char(36) not null,
  created_at datetime(6) not null,
  key signup_ip_claims_user_id_idx (user_id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists credit_ledger (
  id bigint primary key,
  user_id char(36) not null,
  amount int not null,
  reason varchar(128) not null,
  reference_id varchar(255),
  created_at datetime(6) not null,
  key credit_ledger_user_created_idx (user_id, created_at),
  unique key credit_ledger_user_reason_reference_unique (user_id, reason, reference_id),
  constraint credit_ledger_user_id_fk foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists credit_purchases (
  id bigint primary key,
  user_id char(36) not null,
  stripe_checkout_id varchar(255) not null,
  pack_id varchar(128) not null,
  credits int not null,
  amount_cents int not null default 0,
  currency varchar(16) not null default 'usd',
  status enum('pending', 'completed', 'cancelled', 'failed') not null default 'pending',
  created_at datetime(6) not null,
  updated_at datetime(6) not null,
  unique key credit_purchases_stripe_checkout_unique (stripe_checkout_id),
  key credit_purchases_user_created_idx (user_id, created_at),
  constraint credit_purchases_user_id_fk foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists user_subscriptions (
  id bigint primary key,
  user_id char(36) not null,
  stripe_customer_id varchar(255),
  stripe_subscription_id varchar(255) not null,
  plan_id varchar(128) not null,
  cycle varchar(32) not null,
  credits_per_cycle int not null,
  status varchar(64) not null,
  cancel_at_period_end tinyint(1) not null default 0,
  current_period_start datetime(6) null,
  current_period_end datetime(6) null,
  canceled_at datetime(6) null,
  created_at datetime(6) not null,
  updated_at datetime(6) not null,
  unique key user_subscriptions_stripe_subscription_unique (stripe_subscription_id),
  key user_subscriptions_user_updated_idx (user_id, updated_at),
  key user_subscriptions_status_idx (status),
  constraint user_subscriptions_user_id_fk foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists runtime_settings (
  `key` varchar(191) primary key,
  value json not null,
  updated_by varchar(255),
  created_at datetime(6) not null default current_timestamp(6),
  updated_at datetime(6) not null default current_timestamp(6)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists model_daily_usage_events (
  id bigint primary key,
  user_id char(36) not null,
  model_key varchar(128) not null,
  usage_date date not null,
  units int not null,
  reference_id varchar(255) not null,
  refunded_at datetime(6) null,
  created_at datetime(6) not null,
  unique key model_daily_usage_reference_unique (user_id, model_key, reference_id),
  key model_daily_usage_lookup_idx (user_id, model_key, usage_date)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists analytics_events (
  id char(36) primary key,
  user_id char(36),
  anonymous_id varchar(191),
  session_id varchar(191),
  event_name varchar(191) not null,
  event_source varchar(64) not null default 'web',
  page_path text,
  referrer text,
  user_agent text,
  ip_hash varchar(191),
  properties json not null,
  created_at datetime(6) not null,
  key analytics_events_created_at_idx (created_at),
  key analytics_events_event_created_idx (event_name, created_at),
  key analytics_events_user_created_idx (user_id, created_at),
  key analytics_events_session_created_idx (session_id, created_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists public_gallery_items (
  id varchar(191) primary key,
  title text not null,
  category varchar(191) not null,
  image_url text not null,
  thumbnail_url text,
  prompt longtext not null,
  model varchar(191) not null default 'GPT-image-2',
  author_name varchar(255),
  author_handle varchar(255),
  source_platform varchar(64) not null default 'X',
  source_url text not null,
  aspect_ratio varchar(64),
  width int,
  height int,
  is_featured tinyint(1) not null default 0,
  is_published tinyint(1) not null default 1,
  published_at datetime(6) not null,
  created_at datetime(6) not null,
  key public_gallery_published_category_idx (is_published, category, published_at),
  key public_gallery_featured_idx (is_published, is_featured, published_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
