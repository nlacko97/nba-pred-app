-- WS0: one place that defines how many points a pick scored, and picks that
-- lock in the database at tip-off instead of only in the browser.

-- Bonus points are written by the scoring job (upset bonus, later margin
-- calls); they only count when the pick itself is correct
alter table public.picks
  add column if not exists bonus_points smallint not null default 0,
  add column if not exists bonus_reasons text[] not null default '{}';

-- games.status holds the ISO tip time until a game starts, then quarter text,
-- then 'Final'. Keep the tip time in its own column so it survives the game.
create or replace function public.parse_tip_time(p_status text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  if p_status ~ '^\d{4}-\d{2}-\d{2}T' then
    return p_status::timestamptz;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

alter table public.games add column if not exists tip_at timestamptz;

update public.games
set tip_at = public.parse_tip_time(status)
where tip_at is null and public.parse_tip_time(status) is not null;

create or replace function public.set_game_tip_at()
returns trigger
language plpgsql
as $$
begin
  -- Only ever set it: 'Final' or '3rd Qtr' must not erase the tip time
  if public.parse_tip_time(new.status) is not null then
    new.tip_at := public.parse_tip_time(new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_games_tip_at on public.games;
create trigger trg_games_tip_at
  before insert or update of status on public.games
  for each row execute function public.set_game_tip_at();

-- A game is open for picks only while its status is still a future tip time
create or replace function public.game_has_tipped(p_game_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select coalesce(public.parse_tip_time(g.status) <= now(), true)
      from public.games g
      where g.id = p_game_id
    ),
    true
  );
$$;

-- Every scoring feature reads points from here. Game picks score their
-- confidence plus bonuses; All-Star market picks score confidence × multiplier.
-- `settled` is true once the result is known (game Final / market resolved).
create or replace view public.pick_points
with (security_invoker = true)
as
select
  'game'::text as source,
  p.user_id,
  p.id::text as pick_id,
  p.game_id,
  null::bigint as market_id,
  g.date as game_date,
  g.season,
  g.postseason,
  g.stage,
  coalesce(p.confidence_score, 1)::int as confidence_score,
  p.correct,
  p.bonus_points::int as bonus_points,
  p.bonus_reasons,
  g.status = 'Final' as settled,
  case
    when p.correct then coalesce(p.confidence_score, 1) + p.bonus_points
    else 0
  end::int as points
from public.picks p
join public.games g on g.id = p.game_id
union all
select
  'market'::text,
  ap.user_id,
  ap.id::text,
  null::bigint,
  m.id,
  m.event_date,
  m.season,
  m.postseason,
  null::text,
  ap.confidence_score,
  ap.correct,
  0,
  '{}'::text[],
  ap.correct is not null,
  case when ap.correct then ap.confidence_score * m.multiplier else 0 end
from public.all_star_picks ap
join public.all_star_markets m on m.id = ap.market_id;

grant select on public.pick_points to anon, authenticated, service_role;

-- Same output as before; now includes All-Star market points, which the
-- client used to merge in itself
create or replace function public.get_leaderboard_stats(
  p_season integer default null,
  p_postseason boolean default null
)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  total_picks bigint,
  correct_picks bigint,
  total_score numeric,
  accuracy numeric
)
language sql
stable
as $$
  select
    pr.id,
    coalesce(pr.full_name, pr.username),
    pr.avatar_url,
    count(*),
    count(*) filter (where pp.correct),
    sum(pp.points)::numeric,
    round(count(*) filter (where pp.correct)::numeric / nullif(count(*), 0) * 100, 2)
  from public.pick_points pp
  join public.profiles pr on pr.id = pp.user_id
  where pp.settled
    and (p_season is null or pp.season = p_season)
    and (p_postseason is null or pp.postseason = p_postseason)
  group by pr.id
  order by 6 desc;
$$;

create or replace function public.get_user_picks_past_record(
  for_postseason boolean default false,
  p_season integer default null
)
returns table (
  user_id uuid,
  full_name text,
  game_date date,
  correct_picks bigint,
  total_picks bigint,
  accuracy numeric
)
language sql
stable
as $$
  with per_day as (
    select
      pr.id as user_id,
      pr.full_name,
      pp.game_date,
      count(*) filter (where pp.correct) as correct_picks,
      count(*) as total_picks,
      round(count(*) filter (where pp.correct) * 100.0 / nullif(count(*), 0), 1) as accuracy,
      row_number() over (partition by pr.id order by pp.game_date desc) as rn
    from public.pick_points pp
    join public.profiles pr on pr.id = pp.user_id
    where pp.settled
      and pp.game_date < current_date
      and pp.postseason = for_postseason
      and (p_season is null or pp.season = p_season)
    group by pr.id, pr.full_name, pp.game_date
  )
  select user_id, full_name, game_date, correct_picks, total_picks, accuracy
  from per_day
  where rn <= 7
  order by user_id, game_date desc;
$$;

-- Standings for any date range (a night, a week, a month), across regular
-- season and postseason. Ties on points, accuracy and pick count share a rank.
create or replace function public.get_period_leaderboard(p_start date, p_end date)
returns table (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  total_picks bigint,
  correct_picks bigint,
  total_score numeric,
  accuracy numeric,
  rank bigint
)
language sql
stable
as $$
  with totals as (
    select
      pr.id as user_id,
      coalesce(pr.full_name, pr.username) as full_name,
      pr.username,
      pr.avatar_url,
      count(*) as total_picks,
      count(*) filter (where pp.correct) as correct_picks,
      sum(pp.points)::numeric as total_score,
      round(count(*) filter (where pp.correct)::numeric / nullif(count(*), 0) * 100, 2) as accuracy
    from public.pick_points pp
    join public.profiles pr on pr.id = pp.user_id
    where pp.settled and pp.game_date between p_start and p_end
    group by pr.id
  )
  select
    t.*,
    rank() over (order by t.total_score desc, t.accuracy desc, t.total_picks asc)
  from totals t
  order by 9, t.full_name;
$$;

grant execute on function public.get_period_leaderboard(date, date) to anon, authenticated, service_role;

-- Picks lock at tip-off in the database, not just in the browser. Players can
-- only touch their own picks, and never the scoring columns. The scoring job
-- (service role) and direct database access are not restricted.
create or replace function public.enforce_pick_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    if old.user_id is distinct from auth.uid() then
      raise exception 'You can only change your own picks' using errcode = '42501';
    end if;
    if public.game_has_tipped(old.game_id) then
      raise exception 'This game has already started' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'You can only pick for yourself' using errcode = '42501';
  end if;
  if public.game_has_tipped(new.game_id) then
    raise exception 'This game has already started' using errcode = '42501';
  end if;

  -- Results are written by the scoring job only
  if tg_op = 'INSERT' then
    new.correct := null;
    new.bonus_points := 0;
    new.bonus_reasons := '{}';
  else
    new.correct := old.correct;
    new.bonus_points := old.bonus_points;
    new.bonus_reasons := old.bonus_reasons;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_picks_rules on public.picks;
create trigger trg_picks_rules
  before insert or update or delete on public.picks
  for each row execute function public.enforce_pick_rules();

-- The old policies let any signed-in user write any pick
drop policy if exists "Auth users can update" on public.picks;
drop policy if exists "Enable insert for authenticated users only" on public.picks;

create policy "Users can insert their own picks" on public.picks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own picks" on public.picks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- All-Star market picks lock the same way, at the market's lock time
create or replace function public.enforce_all_star_pick_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market_id bigint := coalesce(new.market_id, old.market_id);
  v_locked boolean;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;

  select m.status <> 'open' or m.lock_at <= now()
  into v_locked
  from public.all_star_markets m
  where m.id = v_market_id;

  if coalesce(v_locked, true)
    or (tg_op = 'UPDATE' and new.market_id is distinct from old.market_id) then
    raise exception 'This market is locked' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  new.correct := case when tg_op = 'UPDATE' then old.correct end;
  return new;
end;
$$;

drop trigger if exists trg_all_star_picks_rules on public.all_star_picks;
create trigger trg_all_star_picks_rules
  before insert or update or delete on public.all_star_picks
  for each row execute function public.enforce_all_star_pick_rules();
