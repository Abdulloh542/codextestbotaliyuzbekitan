create table if not exists public.tma_users (
  telegram_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  language_code text,
  is_premium boolean default false,
  allows_write_to_pm boolean default false,
  photo_url text,
  display_name text,
  role text default 'user',
  profile jsonb default '{}'::jsonb,
  preferences jsonb default '{"theme":"light","language":"uz"}'::jsonb,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

create table if not exists public.tma_events (
  id text primary key,
  telegram_id bigint,
  display_name text,
  username text,
  action text not null,
  route text,
  page_key text,
  project_slug text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.tma_reminders (
  id text primary key,
  telegram_id bigint not null,
  username text,
  first_name text,
  last_name text,
  project_slug text not null,
  project_name text not null,
  suggestion text default '',
  notify_me boolean default true,
  status text default 'watching',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  notified_at timestamptz
);

create unique index if not exists tma_reminders_user_project_idx
  on public.tma_reminders (telegram_id, project_slug);

create table if not exists public.tma_notifications (
  id text primary key,
  telegram_id bigint not null,
  project_slug text not null,
  project_name text not null,
  delivery_status text not null,
  error_message text,
  sent_at timestamptz default now()
);

create table if not exists public.tma_projects (
  slug text primary key,
  title text not null,
  tagline text default '',
  description text default '',
  eta text default '3-5 kun',
  category text default 'Service',
  size text default 'wide',
  icon_key text default 'spark',
  accent_key text default 'amber',
  accent text default '#f5c542',
  accent_secondary text default '#ff8a1d',
  image_url text default '',
  cta_link text default '',
  status text default 'building',
  is_visible boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ready_at timestamptz,
  last_notification_at timestamptz
);
