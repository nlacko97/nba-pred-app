-- The game ticket's season series comes from our own results instead of one
-- ESPN summary request per game: earlier meetings this season, same phase.

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
  series_home_wins integer,
  series_away_wins integer,
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
    series.home_wins as series_home_wins,
    series.away_wins as series_away_wins,
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
  -- Earlier meetings this season in the same phase (regular season or
  -- playoffs), from the home team's side
  cross join lateral (
    select
      count(*) filter (where (m.home_team_id = g.home_team_id) = (m.home_team_score > m.away_team_score))::int as home_wins,
      count(*) filter (where (m.home_team_id = g.home_team_id) = (m.home_team_score < m.away_team_score))::int as away_wins
    from public.games m
    where m.season = g.season
      and m.postseason is not distinct from g.postseason
      and m.status = 'Final'
      and m.date < g.date
      and m.home_team_id in (g.home_team_id, g.away_team_id)
      and m.away_team_id in (g.home_team_id, g.away_team_id)
      and m.home_team_id <> m.away_team_id
  ) series
  left join public.picks p on p.game_id = g.id
  left join public.profiles pr on p.user_id = pr.id
  where g.date = game_date_v2
  group by g.id, home_team.id, away_team.id, home_wins.wins, home_wins.losses, away_wins.wins, away_wins.losses, g.status,
    series.home_wins, series.away_wins
  order by g.date asc, g.status;
end;
$$;

grant execute on function public.get_games_by_date_v2(date, integer) to anon, authenticated, service_role;
