-- WS3: +1 point for a correct pick on a team ESPN gave under 30% to win.
-- The probability that counts is the last snapshot taken before tip-off.

alter table public.games
  add column if not exists espn_event_id text,
  add column if not exists home_win_prob numeric(5, 2),
  add column if not exists win_prob_at timestamptz;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings
  for select using (true);

revoke insert, update, delete, truncate on public.app_settings from anon, authenticated;

-- Game day the upset bonus starts counting ('YYYY-MM-DD'); null = off.
-- Set it once the rule has been announced:
--   update app_settings set value = '"2026-10-27"' where key = 'upset_bonus_from';
insert into public.app_settings (key, value)
values ('upset_bonus_from', 'null'::jsonb)
on conflict (key) do nothing;

create or replace function public.upset_bonus_from()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when jsonb_typeof(value) = 'string' then (value #>> '{}')::date
  end
  from public.app_settings
  where key = 'upset_bonus_from';
$$;

-- The picked side's pre-tip win probability, or null when there is no
-- snapshot from before tip-off (never guess)
create or replace function public.pick_win_prob(p_game public.games, p_team_id bigint)
returns numeric
language sql
stable
as $$
  select case
    when p_game.home_win_prob is null
      or p_game.win_prob_at is null
      or p_game.tip_at is null
      or p_game.win_prob_at > p_game.tip_at then null
    when p_team_id = p_game.home_team_id then p_game.home_win_prob
    else 100 - p_game.home_win_prob
  end;
$$;

-- Recompute bonuses for every pick on the Final games of these dates.
-- Idempotent: values are recomputed from scratch, never added to.
create or replace function public.apply_pick_bonuses(p_dates date[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_upset_from date := public.upset_bonus_from();
  v_changed integer;
begin
  with rules as (
    select
      p.id,
      array_remove(
        array[
          case
            when p.correct
              and v_upset_from is not null
              and g.date >= v_upset_from
              and public.pick_win_prob(g, p.picked_team) < 30
            then 'upset'
          end
        ],
        null
      ) as reasons
    from public.picks p
    join public.games g on g.id = p.game_id
    where g.date = any (p_dates) and g.status = 'Final'
  )
  update public.picks p
  set
    bonus_reasons = r.reasons,
    bonus_points = cardinality(r.reasons)
  from rules r
  where p.id = r.id
    and (p.bonus_reasons is distinct from r.reasons
      or p.bonus_points is distinct from cardinality(r.reasons));

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke execute on function public.apply_pick_bonuses(date[]) from public, anon, authenticated;

-- Same as before plus the stored win probability and each pick's bonuses,
-- so the ticket shows exactly what is scored
drop function if exists public.get_games_by_date_v2(date, integer);

create function public.get_games_by_date_v2(game_date_v2 date, p_season integer default 2025)
returns table (
  game_id bigint,
  game_date date,
  home_team_id bigint,
  home_team_name text,
  home_team_abbreviation text,
  home_team_wins bigint,
  home_team_losses bigint,
  away_team_id bigint,
  away_team_name text,
  away_team_abbreviation text,
  away_team_wins bigint,
  away_team_losses bigint,
  home_team_score integer,
  away_team_score integer,
  game_status text,
  stage text,
  home_win_prob numeric,
  upset_bonus boolean,
  picks json
)
language plpgsql
as $$
begin
  return query
  with team_wins as (
    select
      t.id as team_id,
      count(case when g.home_team_id = t.id and g.home_team_score > g.away_team_score then 1
                 when g.away_team_id = t.id and g.away_team_score > g.home_team_score then 1
                 else null end) as wins,
      count(case when g.home_team_id = t.id and g.home_team_score < g.away_team_score then 1
                 when g.away_team_id = t.id and g.away_team_score < g.home_team_score then 1
                 else null end) as losses
    from public.teams t
    left join public.games g on t.id in (g.home_team_id, g.away_team_id)
    where g.status = 'Final' and g.season = p_season
    group by t.id
  )
  select
    g.id as game_id,
    g.date,
    home_team.id as home_team_id,
    home_team.name as home_team_name,
    home_team.abbreviation as home_team_abbreviation,
    home_wins.wins as home_team_wins,
    home_wins.losses as home_team_losses,
    away_team.id as away_team_id,
    away_team.name as away_team_name,
    away_team.abbreviation as away_team_abbreviation,
    away_wins.wins as away_team_wins,
    away_wins.losses as away_team_losses,
    g.home_team_score,
    g.away_team_score,
    g.status as game_status,
    g.stage as stage,
    public.pick_win_prob(g, g.home_team_id) as home_win_prob,
    coalesce(g.date >= public.upset_bonus_from(), false) as upset_bonus,
    json_agg(json_build_object(
      'pick_id', p.id,
      'picked_team', p.picked_team,
      'correct', p.correct,
      'user_id', p.user_id,
      'confidence_score', p.confidence_score,
      'bonus_points', p.bonus_points,
      'bonus_reasons', p.bonus_reasons,
      'user_full_name', pr.full_name
    )) as picks
  from public.games g
  join public.teams home_team on g.home_team_id = home_team.id
  join public.teams away_team on g.away_team_id = away_team.id
  left join team_wins as home_wins on g.home_team_id = home_wins.team_id
  left join team_wins as away_wins on g.away_team_id = away_wins.team_id
  left join public.picks p on p.game_id = g.id
  left join public.profiles pr on p.user_id = pr.id
  where g.date = game_date_v2
  group by g.id, home_team.id, away_team.id, home_wins.wins, home_wins.losses, away_wins.wins, away_wins.losses, g.status
  order by g.date asc, g.status;
end;
$$;

grant execute on function public.get_games_by_date_v2(date, integer) to anon, authenticated, service_role;
