-- Player page: how someone picks. Built only from graded picks (Final games),
-- so nobody's upcoming picks are exposed.

create or replace function public.get_user_scouting(
  p_user_id uuid,
  p_season int,
  p_postseason boolean default null
)
returns jsonb
language sql
stable
as $$
  with graded as (
    select
      o.*,
      cardinality(o.bonus_reasons) as bonus,
      public.pick_win_prob(g, o.picked_team) as win_prob
    from public.ordered_game_picks o
    join public.games g on g.id = o.game_id
    where o.user_id = p_user_id
      and o.season = p_season
      and (p_postseason is null or o.postseason = p_postseason)
  ),
  season_teams as (
    select t.id, t.abbreviation, t.name
    from public.teams t
    where exists (
      select 1 from public.games g
      where g.season = p_season and t.id in (g.home_team_id, g.away_team_id)
    )
  ),
  -- Picking a team, and picking against it (its opponent)
  team_rows as (
    select
      t.id, t.abbreviation, t.name,
      count(*) filter (where gr.picked_team = t.id) as for_picks,
      count(*) filter (where gr.picked_team = t.id and gr.correct) as for_correct,
      count(*) filter (where gr.picked_team <> t.id) as against_picks,
      count(*) filter (where gr.picked_team <> t.id and gr.correct) as against_correct,
      coalesce(sum(gr.confidence_score + gr.bonus) filter (where gr.correct), 0) as points
    from season_teams t
    left join graded gr on t.id in (gr.home_team_id, gr.away_team_id)
    group by t.id, t.abbreviation, t.name
  ),
  nights as (
    select
      game_date,
      count(*) as picks,
      count(*) filter (where correct) as correct,
      coalesce(sum(confidence_score + bonus) filter (where correct), 0) as points,
      bool_or(confidence_score = 3) as went_max
    from graded
    group by game_date
  ),
  confidence as (
    select
      c.level,
      count(gr.pick_id) as picks,
      count(gr.pick_id) filter (where gr.correct) as correct,
      coalesce(sum(gr.confidence_score + gr.bonus) filter (where gr.correct), 0) as points
    from generate_series(1, 3) as c (level)
    left join graded gr on gr.confidence_score = c.level
    group by c.level
  )
  select jsonb_build_object(
    'overall', (
      select jsonb_build_object('picks', count(*), 'correct', count(*) filter (where correct))
      from graded
    ),
    -- Game nights played, how many had a max-confidence call, and the best one
    'nights', (
      select jsonb_build_object(
        'count', count(*),
        'with_max', count(*) filter (where went_max),
        'best', (
          select to_jsonb(n) from nights n
          order by n.points desc, n.correct desc, n.game_date desc
          limit 1
        )
      )
      from nights
    ),
    'confidence', (
      select jsonb_agg(to_jsonb(c) order by c.level) from confidence c
    ),
    'teams', (
      select jsonb_agg(to_jsonb(t) order by t.abbreviation) from team_rows t
    ),
    'sides', (
      select jsonb_build_object(
        'home', jsonb_build_object(
          'picks', count(*) filter (where picked_team = home_team_id),
          'correct', count(*) filter (where picked_team = home_team_id and correct)),
        'away', jsonb_build_object(
          'picks', count(*) filter (where picked_team = away_team_id),
          'correct', count(*) filter (where picked_team = away_team_id and correct))
      )
      from graded
    ),
    -- Only games with a stored pre-tip probability (from the upset bonus)
    'odds', (
      select jsonb_build_object(
        'favorite', jsonb_build_object(
          'picks', count(*) filter (where win_prob >= 50),
          'correct', count(*) filter (where win_prob >= 50 and correct)),
        'underdog', jsonb_build_object(
          'picks', count(*) filter (where win_prob < 50),
          'correct', count(*) filter (where win_prob < 50 and correct))
      )
      from graded
    )
  );
$$;

grant execute on function public.get_user_scouting(uuid, int, boolean) to anon, authenticated, service_role;

-- Every player's picking traits for the season, so a player's card can say
-- where they stand out against the rest of the league. All on a 0–100 scale.
create or replace function public.get_league_traits(
  p_season int,
  p_postseason boolean default null
)
returns table (
  user_id uuid,
  picks bigint,
  eye numeric,
  nerve numeric,
  homer numeric,
  heat int,
  loyalty numeric,
  grind numeric,
  lone numeric,
  clutch numeric
)
language sql
stable
as $$
  with graded as (
    select o.*
    from public.ordered_game_picks o
    where o.season = p_season
      and (p_postseason is null or o.postseason = p_postseason)
  ),
  season_nights as (
    select count(distinct game_date) as n from graded
  ),
  -- How the field split on each game, to spot picks against the crowd
  sides as (
    select g.pick_id,
      count(*) over (partition by g.game_id) as pickers,
      count(*) over (partition by g.game_id, g.picked_team) as same_side
    from graded g
  ),
  runs as (
    select user_id, max(length) as best
    from (
      select user_id, count(*) as length
      from (
        select g.user_id, g.correct,
          g.seq - row_number() over (partition by g.user_id, g.correct order by g.seq) as grp
        from graded g
      ) x
      where correct
      group by user_id, grp
    ) r
    group by user_id
  ),
  team_share as (
    select user_id, sum(n) filter (where rn <= 5) as top_five
    from (
      select g.user_id, g.picked_team, count(*) as n,
        row_number() over (partition by g.user_id order by count(*) desc) as rn
      from graded g
      group by g.user_id, g.picked_team
    ) t
    group by user_id
  )
  select
    g.user_id,
    count(*),
    round(100.0 * count(*) filter (where g.correct) / count(*), 1),
    round(100.0 * count(distinct g.game_date) filter (where g.confidence_score = 3)
      / count(distinct g.game_date), 1),
    round(100.0 * count(*) filter (where g.picked_team = g.home_team_id) / count(*), 1),
    coalesce(max(r.best), 0)::int,
    round(100.0 * max(ts.top_five) / count(*), 1),
    round(100.0 * count(distinct g.game_date) / nullif(max(sn.n), 0), 1),
    round(100.0 * count(*) filter (where s.pickers >= 3 and s.same_side * 2 < s.pickers)
      / nullif(count(*) filter (where s.pickers >= 3), 0), 1),
    case when count(*) filter (where g.confidence_score = 3) >= 5 then
      round(100.0 * count(*) filter (where g.confidence_score = 3 and g.correct)
        / count(*) filter (where g.confidence_score = 3), 1)
    end
  from graded g
  join sides s on s.pick_id = g.pick_id
  left join runs r on r.user_id = g.user_id
  left join team_share ts on ts.user_id = g.user_id
  cross join season_nights sn
  group by g.user_id;
$$;

grant execute on function public.get_league_traits(int, boolean) to anon, authenticated, service_role;
