-- SĀLFA: personal gahwa log
-- Applied to the Supabase project `salfa`. Kept here so the schema is
-- reproducible and reviewable alongside the code.

create table if not exists public.gahwa_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 120),
  place       text check (char_length(place) <= 120),
  with_who    text check (char_length(with_who) <= 120),
  rating      smallint not null check (rating between 1 and 5),
  is_favorite boolean not null default false,
  notes       text check (char_length(notes) <= 2000),
  created_at  timestamptz not null default now()
);

comment on table public.gahwa_logs is 'One row per gahwa a user logs. Private per user, enforced by RLS.';

-- Every query is "my logs, newest first"
create index if not exists gahwa_logs_user_created_idx
  on public.gahwa_logs (user_id, created_at desc);

-- Security boundary: the database, not the frontend.
alter table public.gahwa_logs enable row level security;

drop policy if exists "own logs are selectable" on public.gahwa_logs;
create policy "own logs are selectable"
  on public.gahwa_logs for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own logs are insertable" on public.gahwa_logs;
create policy "own logs are insertable"
  on public.gahwa_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "own logs are updatable" on public.gahwa_logs;
create policy "own logs are updatable"
  on public.gahwa_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own logs are deletable" on public.gahwa_logs;
create policy "own logs are deletable"
  on public.gahwa_logs for delete to authenticated
  using ((select auth.uid()) = user_id);
