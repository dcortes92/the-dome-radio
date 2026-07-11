-- The Dome — initial schema (Supabase)
-- Apply in Supabase SQL editor or via CLI.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  stripe_customer_id text unique,
  subscription_status text not null default 'free'
    check (subscription_status in ('free', 'active', 'canceled', 'past_due')),
  premium_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  station_uuid text not null,
  station_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, station_uuid)
);

create table if not exists public.recents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  station_uuid text not null,
  station_snapshot jsonb not null default '{}'::jsonb,
  played_at timestamptz not null default now(),
  unique (user_id, station_uuid)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.recents enable row level security;

-- Profiles: users read own; update display fields only (payment cols via service role)
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own_display" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "favorites_all_own" on public.favorites
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "recents_all_own" on public.recents
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trim recents to 12 per user
create or replace function public.trim_recents()
returns trigger
language plpgsql
as $$
begin
  delete from public.recents
  where id in (
    select id from public.recents
    where user_id = new.user_id
    order by played_at desc
    offset 12
  );
  return new;
end;
$$;

drop trigger if exists recents_trim on public.recents;
create trigger recents_trim
  after insert or update on public.recents
  for each row execute function public.trim_recents();
