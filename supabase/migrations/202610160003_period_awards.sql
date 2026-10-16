-- WS1: weekly (Monday–Sunday) and monthly titles by US game day. Standings for
-- any range come from get_period_leaderboard (scoring foundation migration);
-- this stores each closed period's top 3.

create table if not exists public.period_awards (
  id bigint generated always as identity primary key,
  season int not null,
  period_type text not null check (period_type in ('week', 'month')),
  period_start date not null,
  period_end date not null,
  user_id uuid not null references public.profiles (id),
  rank int not null,
  points int not null,
  correct_picks int not null,
  total_picks int not null,
  created_at timestamptz not null default now(),
  unique (period_type, period_start, user_id)
);

create index if not exists idx_period_awards_period
  on public.period_awards (period_type, period_end desc);

alter table public.period_awards enable row level security;

drop policy if exists "period_awards_select" on public.period_awards;
create policy "period_awards_select" on public.period_awards
  for select using (true);

revoke insert, update, delete, truncate on public.period_awards from anon, authenticated;

-- The US game day rolls over at 6am Eastern, like gameDayIso() in the app
create or replace function public.us_game_day(p_at timestamptz default now())
returns date
language sql
stable
as $$
  select ((p_at at time zone 'America/New_York') - interval '6 hours')::date;
$$;

create or replace function public.period_bounds(p_type text, p_day date)
returns table (period_start date, period_end date)
language sql
immutable
as $$
  select
    case p_type
      when 'week' then p_day - (extract(isodow from p_day)::int - 1)
      else date_trunc('month', p_day)::date
    end,
    case p_type
      when 'week' then p_day - (extract(isodow from p_day)::int - 1) + 6
      else (date_trunc('month', p_day) + interval '1 month - 1 day')::date
    end;
$$;

-- Award the top 3 of every week and month that has ended and has no awards
-- yet. Safe to run any number of times. A period waits while one of its games
-- has tipped but is not Final yet (up to two days, so a postponed game never
-- blocks it for good).
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
      case
        when extract(month from v_period.period_start) >= 9
          then extract(year from v_period.period_start)::int
        else extract(year from v_period.period_start)::int - 1
      end,
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
  return v_inserted;
end;
$$;

revoke execute on function public.close_periods() from public, anon, authenticated;

-- Daily after the morning scoring run; a no-op on most days
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('close-periods', '0 13 * * *', 'select public.close_periods()');
  end if;
end;
$$;
