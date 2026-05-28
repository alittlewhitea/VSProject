create table if not exists public.generation_tasks (
  id text primary key,
  user_id uuid not null,
  mode text not null check (mode in ('image', 'video', 'audio')),
  provider text not null,
  prompt text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  estimated_credits int not null default 0,
  transport text not null check (transport in ('real', 'mock')),
  status_url text,
  response_url text,
  output_url text,
  raw_result jsonb,
  request_settings jsonb not null default '{}'::jsonb,
  provider_request_id text,
  title text,
  is_favorite boolean not null default false,
  failure_code text,
  failure_reason text,
  last_checked_at timestamptz,
  timed_out_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generation_tasks
  drop constraint if exists generation_tasks_mode_check;
alter table public.generation_tasks
  add constraint generation_tasks_mode_check check (mode in ('image', 'video', 'audio'));

alter table public.generation_tasks
  add column if not exists title text,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists provider_request_id text,
  add column if not exists failure_code text,
  add column if not exists failure_reason text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists timed_out_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
alter table public.generation_tasks
  add column if not exists request_settings jsonb not null default '{}'::jsonb;

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

create table if not exists public.signup_ip_claims (
  ip_hash text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
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

create unique index if not exists credit_ledger_user_reason_reference_unique_idx
  on public.credit_ledger (user_id, reason, reference_id)
  where reference_id is not null;

create or replace function public.apply_credit_ledger_once(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_reference_id text,
  p_allow_negative boolean default false
)
returns table (
  balance int,
  ledger_id bigint,
  duplicate boolean,
  applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id bigint;
  v_balance int;
  v_next_balance int;
  v_ledger_id bigint;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_amount = 0 then
    raise exception 'p_amount cannot be zero';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'p_reason is required';
  end if;

  if p_reference_id is not null then
    select id
      into v_existing_id
      from public.credit_ledger
      where user_id = p_user_id
        and reason = p_reason
        and reference_id = p_reference_id
      limit 1;

    if v_existing_id is not null then
      select user_credit_accounts.balance
        into v_balance
        from public.user_credit_accounts
        where user_credit_accounts.user_id = p_user_id;

      balance := coalesce(v_balance, 0);
      ledger_id := v_existing_id;
      duplicate := true;
      applied := false;
      return next;
      return;
    end if;
  end if;

  insert into public.user_credit_accounts (user_id, balance, free_granted)
  values (p_user_id, 0, false)
  on conflict (user_id) do nothing;

  select user_credit_accounts.balance
    into v_balance
    from public.user_credit_accounts
    where user_credit_accounts.user_id = p_user_id
    for update;

  v_next_balance := v_balance + p_amount;
  if v_next_balance < 0 and not p_allow_negative then
    balance := v_balance;
    ledger_id := null;
    duplicate := false;
    applied := false;
    return next;
    return;
  end if;

  insert into public.credit_ledger (user_id, amount, reason, reference_id)
  values (p_user_id, p_amount, p_reason, p_reference_id)
  returning id into v_ledger_id;

  update public.user_credit_accounts
    set balance = v_next_balance,
        updated_at = now()
    where user_id = p_user_id;

  balance := v_next_balance;
  ledger_id := v_ledger_id;
  duplicate := false;
  applied := true;
  return next;
exception
  when unique_violation then
    if p_reference_id is not null then
      select id
        into v_existing_id
        from public.credit_ledger
        where user_id = p_user_id
          and reason = p_reason
          and reference_id = p_reference_id
        limit 1;

      select user_credit_accounts.balance
        into v_balance
        from public.user_credit_accounts
        where user_credit_accounts.user_id = p_user_id;

      balance := coalesce(v_balance, 0);
      ledger_id := v_existing_id;
      duplicate := true;
      applied := false;
      return next;
      return;
    end if;
    raise;
end;
$$;

revoke all on function public.apply_credit_ledger_once(uuid, int, text, text, boolean) from public;
revoke all on function public.apply_credit_ledger_once(uuid, int, text, text, boolean) from anon;
revoke all on function public.apply_credit_ledger_once(uuid, int, text, text, boolean) from authenticated;
grant execute on function public.apply_credit_ledger_once(uuid, int, text, text, boolean) to service_role;

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
alter table public.signup_ip_claims enable row level security;
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

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  anonymous_id text,
  session_id text,
  event_name text not null,
  event_source text not null default 'web',
  page_path text,
  referrer text,
  user_agent text,
  ip_hash text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_name_created_at_idx
  on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_user_id_created_at_idx
  on public.analytics_events (user_id, created_at desc);

create index if not exists analytics_events_session_id_created_at_idx
  on public.analytics_events (session_id, created_at desc);

alter table public.analytics_events enable row level security;

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
