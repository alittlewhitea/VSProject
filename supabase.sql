create table if not exists public.generation_tasks (
  id text primary key,
  user_id uuid not null,
  mode text not null check (mode in ('image', 'video')),
  provider text not null,
  prompt text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  estimated_credits int not null default 0,
  transport text not null check (transport in ('real', 'mock')),
  status_url text,
  response_url text,
  output_url text,
  raw_result jsonb,
  title text,
  is_favorite boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generation_tasks
  add column if not exists title text,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists generation_tasks_user_id_created_at_idx
  on public.generation_tasks (user_id, created_at desc);

create index if not exists generation_tasks_user_id_active_created_at_idx
  on public.generation_tasks (user_id, created_at desc)
  where deleted_at is null;

create index if not exists generation_tasks_user_id_favorite_idx
  on public.generation_tasks (user_id, is_favorite, created_at desc)
  where deleted_at is null;

alter table public.generation_tasks enable row level security;

drop policy if exists "Users can view own tasks" on public.generation_tasks;
create policy "Users can view own tasks"
  on public.generation_tasks for select
  using (auth.uid() = user_id);

create table if not exists public.user_credit_accounts (
  user_id uuid primary key,
  balance int not null default 0,
  free_granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null,
  amount int not null,
  reason text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_id_created_at_idx
  on public.credit_ledger (user_id, created_at desc);

create table if not exists public.credit_purchases (
  id bigserial primary key,
  user_id uuid not null,
  stripe_checkout_id text not null unique,
  pack_id text not null,
  credits int not null,
  amount_cents int not null default 0,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credit_purchases_user_id_created_at_idx
  on public.credit_purchases (user_id, created_at desc);

alter table public.user_credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_purchases enable row level security;

drop policy if exists "Users can view own credit account" on public.user_credit_accounts;
create policy "Users can view own credit account"
  on public.user_credit_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can view own credit ledger" on public.credit_ledger;
create policy "Users can view own credit ledger"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

drop policy if exists "Users can view own credit purchases" on public.credit_purchases;
create policy "Users can view own credit purchases"
  on public.credit_purchases for select
  using (auth.uid() = user_id);

create extension if not exists pgcrypto;

create table if not exists public.public_gallery_items (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  category text not null check (category in (
    '电商广告',
    '内容创作',
    '产品设计',
    '文旅文创',
    '游戏影视',
    '摄影后期',
    '建筑场景',
    '生活日常'
  )),
  image_url text not null,
  thumbnail_url text,
  prompt text not null,
  model text not null default 'GPT-image-2',
  author_name text,
  author_handle text,
  source_platform text not null default 'X',
  source_url text not null,
  aspect_ratio text,
  width int,
  height int,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists public_gallery_items_published_category_idx
  on public.public_gallery_items (is_published, category, published_at desc);

create index if not exists public_gallery_items_featured_idx
  on public.public_gallery_items (is_published, is_featured desc, published_at desc);

alter table public.public_gallery_items enable row level security;

drop policy if exists "Anyone can view published gallery items" on public.public_gallery_items;
create policy "Anyone can view published gallery items"
  on public.public_gallery_items for select
  using (is_published = true);

-- Manual curation insert example:
-- insert into public.public_gallery_items (
--   title, category, image_url, thumbnail_url, prompt, model,
--   author_name, author_handle, source_platform, source_url,
--   aspect_ratio, width, height, is_featured
-- ) values (
--   'Luxury perfume product visual',
--   '电商广告',
--   'https://your-cdn.example/perfume.png',
--   'https://your-cdn.example/perfume-thumb.png',
--   'Prompt text copied or summarized from the original post...',
--   'GPT-image-2',
--   'Creator Name',
--   'creator_handle',
--   'X',
--   'https://x.com/creator/status/123',
--   '4:5',
--   1536,
--   1920,
--   true
-- );
