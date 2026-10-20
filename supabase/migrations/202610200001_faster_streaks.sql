-- get_streaks and get_user_badges counted the live runs with a subquery per
-- pick, re-reading every graded pick each time: over a full season that ran
-- past the API's statement timeout. Each player's (and team's) last miss is
-- now found once. Same results.

create or replace function public.get_streaks(p_season int)
returns table (user_id uuid, correct_streak int, day_streak int)
language sql
stable
as $$
  with graded as (
    select o.user_id, o.seq, o.correct
    from public.ordered_game_picks o
    where o.season = p_season
  ),
  -- Correct picks since each player's last miss, finding the miss once
  correct_runs as (
    select g.user_id,
      count(*) filter (where g.seq > coalesce(m.last_miss, 0))::int as correct_streak
    from graded g
    join (
      select user_id, max(seq) filter (where not correct) as last_miss
      from graded
      group by user_id
    ) m using (user_id)
    group by g.user_id
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
    join (
      select picked_team, max(seq) filter (where not correct) as last_miss
      from graded
      group by picked_team
    ) m using (picked_team)
    where g.correct and g.seq > coalesce(m.last_miss, 0)
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
