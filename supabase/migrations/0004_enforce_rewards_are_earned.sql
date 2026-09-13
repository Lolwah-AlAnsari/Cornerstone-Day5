-- Rewards must be earned, decided by the database rather than the browser.
--
-- Until now "is this earned?" was computed in JavaScript and the claim was a
-- plain insert, so anyone could grant themselves any reward from the console.
-- The thresholds below mirror js/rewards.js exactly; if one changes, both
-- must change together.

create or replace function public.reward_is_earned(p_reward_key text)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with tally as (
    select
      count(*)                                                                 as total,
      count(*) filter (where is_favorite)                                      as favourites,
      count(distinct lower(trim(place)))
        filter (where place is not null and trim(place) <> '')                 as places,
      count(distinct lower(trim(with_who)))
        filter (where with_who is not null and trim(with_who) <> '')           as companions,
      count(*) filter (where rating = 5)                                       as five_stars,
      count(*) filter (where notes is not null and trim(notes) <> '')          as with_notes
    from public.gahwa_logs
    where user_id = (select auth.uid())
  )
  select case p_reward_key
    when 'firstCup'      then total      >= 1
    when 'fiveCups'      then total      >= 5
    when 'tenCups'       then total      >= 10
    when 'twentyFive'    then total      >= 25
    when 'curator'       then favourites >= 5
    when 'explorer'      then places     >= 5
    when 'company'       then companions >= 5
    when 'perfectionist' then five_stars >= 3
    when 'storyteller'   then with_notes >= 5
    else false
  end
  from tally;
$$;

comment on function public.reward_is_earned(text) is
  'True when the calling user has genuinely earned the named reward. Reads only the caller''s own logs.';

-- Only signed-in users may ask, and only about themselves.
revoke all on function public.reward_is_earned(text) from public;
grant execute on function public.reward_is_earned(text) to authenticated;

-- Only the nine real rewards can ever be stored.
alter table public.reward_claims drop constraint if exists reward_claims_known_key;
alter table public.reward_claims add constraint reward_claims_known_key
  check (reward_key in (
    'firstCup','fiveCups','tenCups','twentyFive','curator',
    'explorer','company','perfectionist','storyteller'
  ));

-- The claim is now refused unless the reward is actually earned.
drop policy if exists "own claims are insertable" on public.reward_claims;
create policy "own claims are insertable"
  on public.reward_claims for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.reward_is_earned(reward_key)
  );
