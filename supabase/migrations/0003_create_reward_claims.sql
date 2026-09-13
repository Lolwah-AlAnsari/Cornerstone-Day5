-- SĀLFA: collected rewards
--
-- Whether a reward is *earned* is derived from gahwa_logs at render time, so it
-- can never drift from reality and needs no bookkeeping. Only the act of
-- collecting one is stored, which is all this table holds. gahwa_logs is not
-- touched by this migration.

create table if not exists public.reward_claims (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reward_key text not null check (char_length(reward_key) between 1 and 60),
  claimed_at timestamptz not null default now(),
  -- A reward is collected once, or not at all.
  unique (user_id, reward_key)
);

comment on table public.reward_claims is 'One row per reward a user has collected. Earned status is derived from gahwa_logs; only the claim is stored.';

create index if not exists reward_claims_user_idx on public.reward_claims (user_id);

alter table public.reward_claims enable row level security;

drop policy if exists "own claims are selectable" on public.reward_claims;
create policy "own claims are selectable"
  on public.reward_claims for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own claims are insertable" on public.reward_claims;
create policy "own claims are insertable"
  on public.reward_claims for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "own claims are updatable" on public.reward_claims;
create policy "own claims are updatable"
  on public.reward_claims for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own claims are deletable" on public.reward_claims;
create policy "own claims are deletable"
  on public.reward_claims for delete to authenticated
  using ((select auth.uid()) = user_id);
