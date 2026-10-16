-- WS2: badges and streaks. One idempotent award_<slug>(p_date) per badge;
-- award_badges(p_date) runs them all for a scored US game day. Running every
-- date since opening night again awards nothing new.

create table if not exists public.badges (
  slug text primary key,
  name text not null,
  description text not null,
  family text not null check (family in ('night', 'run', 'title')),
  sort_order int not null
);

create table if not exists public.user_badges (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  badge_slug text not null references public.badges (slug),
  season int not null,
  earned_on date not null,
  award_key text not null,
  context jsonb not null default '{}',
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, badge_slug, award_key)
);

create index if not exists idx_user_badges_user on public.user_badges (user_id, season);
create index if not exists idx_user_badges_unseen on public.user_badges (user_id) where seen_at is null;

insert into public.badges (slug, name, description, family, sort_order) values
  ('perfect-night', 'Perfect Night', 'Every pick correct on a game day, with at least 4 game picks.', 'night', 10),
  ('all-in', 'All In', '3 or more picks at confidence 3, all correct, on one game day.', 'night', 20),
  ('buzzer-beater', 'Buzzer Beater', 'A correct pick in a game decided by 3 points or fewer, or in overtime.', 'night', 30),
  ('contrarian', 'Contrarian', 'A correct pick on the side 25% or fewer of pickers chose (at least 8 pickers).', 'night', 40),
  ('hot-hand', 'Hot Hand', '10 correct game picks in a row.', 'run', 50),
  ('iron-man', 'Iron Man', 'A pick on 30 game days in a row.', 'run', 60),
  ('oracle', 'Oracle', '70% or better in a calendar month with at least 40 game picks.', 'run', 70),
  ('team-whisperer', 'Team Whisperer', '10 correct picks in a row on the same team.', 'run', 80),
  ('upset-hunter', 'Upset Hunter', '5 correct upset picks in a season.', 'run', 90),
  ('weekly-crown', 'Weekly Crown', 'Most points in a week.', 'title', 100),
  ('monthly-crown', 'Monthly Crown', 'Most points in a month.', 'title', 110),
  ('cup-crusher', 'Cup Crusher', 'Most points across NBA Cup games.', 'title', 120),
  ('climber', 'Climber', 'Up 10 or more places on the season leaderboard in a week.', 'title', 130)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  family = excluded.family,
  sort_order = excluded.sort_order;

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists "badges_select" on public.badges;
create policy "badges_select" on public.badges for select using (true);

drop policy if exists "user_badges_select" on public.user_badges;
create policy "user_badges_select" on public.user_badges for select using (true);

-- Players may only mark their own badges as seen
drop policy if exists "user_badges_mark_seen" on public.user_badges;
create policy "user_badges_mark_seen" on public.user_badges
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke insert, update, delete, truncate on public.badges from anon, authenticated;
revoke insert, update, delete, truncate on public.user_badges from anon, authenticated;
grant update (seen_at) on public.user_badges to authenticated;

-- ─── Helpers ───

create or replace function public.season_for_date(p_day date)
returns int
language sql
immutable
as $$
  select case
    when extract(month from p_day) >= 9 then extract(year from p_day)::int
    else extract(year from p_day)::int - 1
  end;
$$;

-- Graded game picks in play order (tip time, then game id)
create or replace view public.ordered_game_picks
with (security_invoker = true)
as
select
  p.id as pick_id,
  p.user_id,
  p.game_id,
  p.picked_team,
  coalesce(p.confidence_score, 1) as confidence_score,
  p.correct,
  p.bonus_reasons,
  g.date as game_date,
  g.season,
  g.postseason,
  g.stage,
  g.period,
  g.home_team_score,
  g.away_team_score,
  g.home_team_id,
  g.away_team_id,
  row_number() over (
    partition by p.user_id, g.season
    order by g.date, g.tip_at nulls last, g.id
  ) as seq
from public.picks p
join public.games g on g.id = p.game_id
where g.status = 'Final' and p.correct is not null;

-- ─── Night badges ───

create or replace function public.award_perfect_night(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select p.user_id, 'perfect-night', g.season, p_date,
      'perfect-night:' || p_date, jsonb_build_object('picks', count(*))
    from public.picks p
    join public.games g on g.id = p.game_id
    where g.date = p_date
    group by p.user_id, g.season
    having count(*) >= 4 and bool_and(coalesce(p.correct, false) and g.status = 'Final')
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

create or replace function public.award_all_in(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select p.user_id, 'all-in', g.season, p_date,
      'all-in:' || p_date, jsonb_build_object('picks', count(*))
    from public.picks p
    join public.games g on g.id = p.game_id
    where g.date = p_date and p.confidence_score = 3
    group by p.user_id, g.season
    having count(*) >= 3 and bool_and(coalesce(p.correct, false) and g.status = 'Final')
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

create or replace function public.award_buzzer_beater(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select distinct on (o.user_id) o.user_id, 'buzzer-beater', o.season, p_date,
      'buzzer-beater:' || p_date,
      jsonb_build_object(
        'game_id', o.game_id,
        'margin', abs(o.home_team_score - o.away_team_score),
        'overtime', o.period > 4
      )
    from public.ordered_game_picks o
    where o.game_date = p_date
      and o.correct
      and (abs(o.home_team_score - o.away_team_score) <= 3 or o.period > 4)
    order by o.user_id, abs(o.home_team_score - o.away_team_score), o.game_id
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

create or replace function public.award_contrarian(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with split as (
    select
      o.*,
      count(*) over (partition by o.game_id) as pickers,
      count(*) over (partition by o.game_id, o.picked_team) as same_side
    from public.ordered_game_picks o
    where o.game_date = p_date
  ),
  ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select distinct on (s.user_id) s.user_id, 'contrarian', s.season, p_date,
      'contrarian:' || p_date,
      jsonb_build_object('game_id', s.game_id, 'share', round(s.same_side * 100.0 / s.pickers))
    from split s
    where s.correct and s.pickers >= 8 and s.same_side * 4 <= s.pickers
    order by s.user_id, s.same_side::numeric / s.pickers, s.game_id
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

-- ─── Run badges ───

-- One badge per streak of 10+ correct picks, keyed by the streak's first pick
create or replace function public.award_hot_hand(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with picks as (
    select o.*, o.seq - row_number() over (partition by o.user_id, o.season, o.correct order by o.seq) as grp
    from public.ordered_game_picks o
    where o.season = public.season_for_date(p_date) and o.game_date <= p_date
  ),
  runs as (
    select
      user_id, season,
      (array_agg(pick_id order by seq))[1] as first_pick,
      (array_agg(game_date order by seq))[10] as tenth_day,
      count(*) as length
    from picks
    where correct
    group by user_id, season, grp
    having count(*) >= 10
  ),
  ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select user_id, 'hot-hand', season, tenth_day,
      'hot-hand:' || season || ':' || first_pick, jsonb_build_object('streak', length)
    from runs
    -- The badge stays; its streak length only ever grows as the run goes on
    on conflict (user_id, badge_slug, award_key)
      do update set context = excluded.context
      where (public.user_badges.context ->> 'streak')::int
        < (excluded.context ->> 'streak')::int
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted)::int from ins;
$$;

-- Days without NBA games don't break the run: count game days, not dates
create or replace function public.award_iron_man(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with game_days as (
    select g.date, row_number() over (order by g.date) as idx
    from (
      select distinct date from public.games
      where season = public.season_for_date(p_date) and date <= p_date
    ) g
  ),
  user_days as (
    select distinct pp.user_id, d.date, d.idx
    from public.pick_points pp
    join game_days d on d.date = pp.game_date
    where pp.source = 'game'
  ),
  runs as (
    select user_id, idx - row_number() over (partition by user_id order by idx) as grp, date
    from user_days
  ),
  qualified as (
    select user_id, (array_agg(date order by date))[30] as thirtieth_day
    from runs
    group by user_id, grp
    having count(*) >= 30
  ),
  ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select distinct on (user_id) user_id, 'iron-man', public.season_for_date(p_date), thirtieth_day,
      'iron-man:' || public.season_for_date(p_date), jsonb_build_object('days', 30)
    from qualified
    order by user_id, thirtieth_day
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

-- Judged once the month is over (accuracy can still drop until then)
create or replace function public.award_oracle(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with months as (
    select
      o.user_id, o.season,
      date_trunc('month', o.game_date)::date as month,
      count(*) as picks,
      count(*) filter (where o.correct) as correct
    from public.ordered_game_picks o
    where o.season = public.season_for_date(p_date)
      and (date_trunc('month', o.game_date) + interval '1 month - 1 day')::date <= p_date
    group by 1, 2, 3
  ),
  ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select user_id, 'oracle', season, (month + interval '1 month - 1 day')::date,
      'oracle:' || to_char(month, 'YYYY-MM'),
      jsonb_build_object('picks', picks, 'accuracy', round(correct * 100.0 / picks, 1))
    from months
    where picks >= 40 and correct * 100 >= picks * 70
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

create or replace function public.award_team_whisperer(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with picks as (
    select o.*,
      row_number() over (partition by o.user_id, o.season, o.picked_team order by o.seq)
      - row_number() over (partition by o.user_id, o.season, o.picked_team, o.correct order by o.seq) as grp
    from public.ordered_game_picks o
    where o.season = public.season_for_date(p_date) and o.game_date <= p_date
  ),
  runs as (
    select user_id, season, picked_team, (array_agg(game_date order by seq))[10] as tenth_day
    from picks
    where correct
    group by user_id, season, picked_team, grp
    having count(*) >= 10
  ),
  ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select distinct on (r.user_id, r.picked_team) r.user_id, 'team-whisperer', r.season, r.tenth_day,
      'team-whisperer:' || r.season || ':' || t.abbreviation,
      jsonb_build_object('team_id', r.picked_team, 'team', t.abbreviation)
    from runs r
    join public.teams t on t.id = r.picked_team
    order by r.user_id, r.picked_team, r.tenth_day
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

create or replace function public.award_upset_hunter(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with upsets as (
    select o.user_id, o.season, o.game_date,
      row_number() over (partition by o.user_id order by o.seq) as n
    from public.ordered_game_picks o
    where o.season = public.season_for_date(p_date)
      and o.game_date <= p_date
      and o.correct
      and 'upset' = any (o.bonus_reasons)
  ),
  ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select user_id, 'upset-hunter', season, game_date, 'upset-hunter:' || season,
      jsonb_build_object('upsets', 5)
    from upsets
    where n = 5
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

-- ─── Title badges ───

create or replace function public.award_crowns()
returns integer
language sql
security definer
set search_path = ''
as $$
  with ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select a.user_id,
      case a.period_type when 'week' then 'weekly-crown' else 'monthly-crown' end,
      a.season, a.period_end,
      case a.period_type when 'week' then 'weekly-crown:' else 'monthly-crown:' end || a.period_start,
      jsonb_build_object('points', a.points, 'period_start', a.period_start)
    from public.period_awards a
    where a.rank = 1
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

-- Rank on the regular-season leaderboard as of a Monday (games before it)
create or replace function public.season_ranks_before(p_season int, p_cutoff date)
returns table (user_id uuid, rank bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select pp.user_id, sum(pp.points) as points, count(*) filter (where pp.correct) as correct
    from public.pick_points pp
    where pp.settled and pp.season = p_season and pp.postseason = false and pp.game_date < p_cutoff
    group by pp.user_id
    having count(*) >= 20
  )
  select user_id, rank() over (order by points desc, correct desc)
  from totals;
$$;

-- Runs on a Sunday's results: the week ends, compare Monday to Monday
create or replace function public.award_climber(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with this_week as (
    select * from public.season_ranks_before(public.season_for_date(p_date), p_date + 1)
  ),
  last_week as (
    select * from public.season_ranks_before(public.season_for_date(p_date), p_date - 6)
  ),
  ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select t.user_id, 'climber', public.season_for_date(p_date), p_date,
      'climber:' || (p_date + 1),
      jsonb_build_object('from', l.rank, 'to', t.rank)
    from this_week t
    join last_week l using (user_id)
    where extract(isodow from p_date) = 7 and l.rank - t.rank >= 10
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

-- Once the NBA Cup final is Final: most points across all Cup games
create or replace function public.award_cup_crusher(p_date date)
returns integer
language sql
security definer
set search_path = ''
as $$
  with final as (
    select g.season, g.date
    from public.games g
    where g.season = public.season_for_date(p_date)
      and g.date <= p_date
      and g.status = 'Final'
      and g.stage ~* 'nba cup'
      and g.stage ~* '\m(final|championship)\M'
    limit 1
  ),
  totals as (
    select pp.user_id, sum(pp.points) as points,
      rank() over (order by sum(pp.points) desc) as rank
    from public.pick_points pp
    join final f on f.season = pp.season
    where pp.settled and pp.stage ~* 'nba cup'
    group by pp.user_id
  ),
  ins as (
    insert into public.user_badges (user_id, badge_slug, season, earned_on, award_key, context)
    select t.user_id, 'cup-crusher', f.season, f.date, 'cup-crusher:' || f.season,
      jsonb_build_object('points', t.points)
    from totals t, final f
    where t.rank = 1 and t.points > 0
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;

-- ─── Engine ───

create or replace function public.award_badges(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'perfect-night', public.award_perfect_night(p_date),
    'all-in', public.award_all_in(p_date),
    'buzzer-beater', public.award_buzzer_beater(p_date),
    'contrarian', public.award_contrarian(p_date),
    'hot-hand', public.award_hot_hand(p_date),
    'iron-man', public.award_iron_man(p_date),
    'oracle', public.award_oracle(p_date),
    'team-whisperer', public.award_team_whisperer(p_date),
    'upset-hunter', public.award_upset_hunter(p_date),
    'climber', public.award_climber(p_date),
    'cup-crusher', public.award_cup_crusher(p_date)
  );
end;
$$;

-- Crowns are awarded as soon as a period closes
create or replace function public.close_periods()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.us_game_day();
  v_period record;
  v_inserted integer := 0;
  v_rows integer;
begin
  for v_period in
    select distinct t.period_type, b.period_start, b.period_end
    from public.pick_points pp
    cross join (values ('week'), ('month')) as t (period_type)
    cross join lateral public.period_bounds(t.period_type, pp.game_date) b
    where pp.settled and b.period_end < v_today
    order by b.period_start, t.period_type
  loop
    continue when exists (
      select 1 from public.period_awards a
      where a.period_type = v_period.period_type
        and a.period_start = v_period.period_start
    );
    continue when exists (
      select 1 from public.games g
      where g.date between v_period.period_start and v_period.period_end
        and g.status is distinct from 'Final'
        and g.tip_at <= now()
        and g.tip_at > now() - interval '2 days'
    );

    insert into public.period_awards (
      season, period_type, period_start, period_end, user_id,
      rank, points, correct_picks, total_picks
    )
    select
      public.season_for_date(v_period.period_start),
      v_period.period_type,
      v_period.period_start,
      v_period.period_end,
      l.user_id,
      l.rank,
      l.total_score,
      l.correct_picks,
      l.total_picks
    from public.get_period_leaderboard(v_period.period_start, v_period.period_end) l
    where l.rank <= 3
    on conflict (period_type, period_start, user_id) do nothing;

    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;
  end loop;

  perform public.award_crowns();
  return v_inserted;
end;
$$;

-- ─── Reads for the UI ───

-- Current correct-pick streak and daily-pick streak per player. A game day
-- still being played does not break the daily streak before you pick.
create or replace function public.get_streaks(p_season int)
returns table (user_id uuid, correct_streak int, day_streak int)
language sql
stable
as $$
  with correct_runs as (
    select o.user_id,
      count(*) filter (
        where o.seq > coalesce(
          (select max(o2.seq) from public.ordered_game_picks o2
           where o2.user_id = o.user_id and o2.season = p_season and not o2.correct),
          0)
      )::int as correct_streak
    from public.ordered_game_picks o
    where o.season = p_season
    group by o.user_id
  ),
  game_days as (
    select date, row_number() over (order by date desc) as back
    from (
      select distinct date from public.games
      where season = p_season and date <= public.us_game_day()
    ) d
  ),
  user_days as (
    select distinct p.user_id, d.back
    from public.picks p
    join public.games g on g.id = p.game_id
    join game_days d on d.date = g.date
  ),
  -- Today's slate (back = 1) may still be open: if it is today and has no
  -- pick yet, start counting from the game day before it
  offsets as (
    select u.user_id,
      case
        when exists (select 1 from game_days d where d.back = 1 and d.date = public.us_game_day())
          and not exists (select 1 from user_days t where t.user_id = u.user_id and t.back = 1)
        then 1 else 0
      end as skip
    from (select distinct user_id from user_days) u
  ),
  day_runs as (
    -- Consecutive game days from the start: back - skip equals the row number
    select u.user_id,
      count(*) filter (where u.back - o.skip = u.rn)::int as day_streak
    from (
      select ud.*, row_number() over (partition by ud.user_id order by ud.back) as rn
      from user_days ud
    ) u
    join offsets o using (user_id)
    group by u.user_id
  )
  select coalesce(c.user_id, d.user_id), coalesce(c.correct_streak, 0), coalesce(d.day_streak, 0)
  from correct_runs c
  full join day_runs d on d.user_id = c.user_id;
$$;

-- Earned badges, counts per slug and progress toward the ones still missing
create or replace function public.get_user_badges(p_user_id uuid, p_season int)
returns jsonb
language sql
stable
as $$
  with earned as (
    select ub.badge_slug, ub.earned_on, ub.award_key, ub.context, ub.seen_at, ub.id
    from public.user_badges ub
    where ub.user_id = p_user_id and ub.season = p_season
  ),
  graded as (
    select * from public.ordered_game_picks o
    where o.user_id = p_user_id and o.season = p_season
  ),
  team_runs as (
    select picked_team, count(*) as length
    from (
      select g.*,
        row_number() over (partition by g.picked_team order by g.seq)
        - row_number() over (partition by g.picked_team, g.correct order by g.seq) as grp
      from graded g
    ) x
    where correct
    group by picked_team, grp
  ),
  current_team_runs as (
    -- The run still alive for each team: correct picks since the last miss
    select g.picked_team, count(*) as length
    from graded g
    where g.correct and g.seq > coalesce(
      (select max(m.seq) from graded m where m.picked_team = g.picked_team and not m.correct), 0)
    group by g.picked_team
  ),
  this_month as (
    select count(*) as picks, count(*) filter (where correct) as correct
    from graded
    where date_trunc('month', game_date) = date_trunc('month', public.us_game_day())
  ),
  streaks as (
    select * from public.get_streaks(p_season) s where s.user_id = p_user_id
  ),
  -- Longest runs this season, for "best: 15" next to the live streaks
  best_correct as (
    select coalesce(max(length), 0) as length
    from (
      select count(*) as length
      from (select g.correct, g.seq - row_number() over (partition by g.correct order by g.seq) as grp from graded g) x
      where correct
      group by grp
    ) runs
  ),
  best_days as (
    select coalesce(max(length), 0) as length
    from (
      select count(*) as length
      from (
        select d.idx - row_number() over (order by d.idx) as grp
        from (
          select row_number() over (order by date) as idx, date
          from (select distinct date from public.games where season = p_season and date <= public.us_game_day()) gd
        ) d
        where exists (
          select 1 from public.picks p join public.games g on g.id = p.game_id
          where p.user_id = p_user_id and g.date = d.date
        )
      ) x
      group by grp
    ) runs
  )
  select jsonb_build_object(
    'earned', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.earned_on desc, e.id desc)
      from earned e
    ), '[]'::jsonb),
    'counts', coalesce((
      select jsonb_object_agg(badge_slug, n)
      from (select badge_slug, count(*) as n from earned group by badge_slug) c
    ), '{}'::jsonb),
    'progress', jsonb_build_object(
      'hot-hand', jsonb_build_object('current', coalesce((select correct_streak from streaks), 0), 'target', 10,
        'best', (select length from best_correct)),
      'iron-man', jsonb_build_object('current', coalesce((select day_streak from streaks), 0), 'target', 30,
        'best', (select length from best_days)),
      'upset-hunter', jsonb_build_object(
        'current', (select count(*) from graded where correct and 'upset' = any (bonus_reasons)),
        'target', 5),
      'team-whisperer', (
        select jsonb_build_object('current', coalesce(max(r.length), 0), 'target', 10,
          'team', (array_agg(t.abbreviation order by r.length desc))[1],
          'best', (select coalesce(max(length), 0) from team_runs))
        from current_team_runs r join public.teams t on t.id = r.picked_team
      ),
      'oracle', (
        select jsonb_build_object('picks', picks, 'picks_target', 40,
          'accuracy', case when picks > 0 then round(correct * 100.0 / picks, 1) end, 'accuracy_target', 70)
        from this_month
      )
    )
  );
$$;

grant execute on function public.get_streaks(int) to anon, authenticated, service_role;
grant execute on function public.get_user_badges(uuid, int) to anon, authenticated, service_role;

do $$
declare
  f text;
begin
  foreach f in array array[
    'award_perfect_night(date)', 'award_all_in(date)', 'award_buzzer_beater(date)',
    'award_contrarian(date)', 'award_hot_hand(date)', 'award_iron_man(date)',
    'award_oracle(date)', 'award_team_whisperer(date)', 'award_upset_hunter(date)',
    'award_climber(date)', 'award_cup_crusher(date)', 'award_crowns()',
    'award_badges(date)', 'close_periods()', 'season_ranks_before(integer, date)'
  ]
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$$;
