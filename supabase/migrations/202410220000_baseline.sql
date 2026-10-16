-- Baseline: the live public schema as of 2026-10-16 (supabase db dump).
-- Dated before the All-Star migrations so a fresh database replays in order;
-- the All-Star tables, policies and trigger function are left to those files.
-- Already applied in production: mark it with
--   supabase migration repair --status applied 202410220000

create extension if not exists moddatetime with schema extensions;


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE PROCEDURE "public"."get_games_by_date"(IN "game_date" "date")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  WITH team_wins AS (
    SELECT
      t.id AS team_id,
      COUNT(CASE WHEN g.home_team_id = t.id AND g.home_team_score > g.away_team_score THEN 1
                 WHEN g.away_team_id = t.id AND g.away_team_score > g.home_team_score THEN 1
                 ELSE NULL END) AS wins,
      COUNT(CASE WHEN g.home_team_id = t.id AND g.home_team_score < g.away_team_score THEN 1
                 WHEN g.away_team_id = t.id AND g.away_team_score < g.home_team_score THEN 1
                 ELSE NULL END) AS losses
    FROM
      teams t
    LEFT JOIN
      games g ON t.id IN (g.home_team_id, g.away_team_id)
    WHERE
      g.status = 'Final'
    GROUP BY
      t.id
  )

  SELECT
    g.id AS game_id,
    g.date,
    home_team.id AS home_team_id,
    home_team.name AS home_team_name,
    home_team.abbreviation AS home_team_abbreviation,
    home_wins.wins AS home_team_wins,
    home_wins.losses AS home_team_losses,
    away_team.id AS away_team_id,
    away_team.name AS away_team_name,
    away_team.abbreviation AS away_team_abbreviation,
    away_wins.wins AS away_team_wins,
    away_wins.losses AS away_team_losses,
    g.home_team_score,
    g.away_team_score,
    json_agg(json_build_object(
      'pick_id', p.id,
      'picked_team', p.picked_team,
      'correct', p.correct,
      'user_id', p.user_id
    )) AS picks
  FROM
    games g
  JOIN
    teams home_team ON g.home_team_id = home_team.id
  JOIN
    teams away_team ON g.away_team_id = away_team.id
  LEFT JOIN
    team_wins AS home_wins ON g.home_team_id = home_wins.team_id
  LEFT JOIN
    team_wins AS away_wins ON g.away_team_id = away_wins.team_id
  LEFT JOIN
    picks p ON p.game_id = g.id
  WHERE
    g.date = game_date
  GROUP BY
    g.id, home_team.id, away_team.id, home_wins.wins, home_wins.losses, away_wins.wins, away_wins.losses
  ORDER BY
    g.date;
END;
$$;

ALTER PROCEDURE "public"."get_games_by_date"(IN "game_date" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date") RETURNS TABLE("game_id" bigint, "game_date" "date", "home_team_id" bigint, "home_team_name" "text", "home_team_abbreviation" "text", "home_team_wins" bigint, "home_team_losses" bigint, "away_team_id" bigint, "away_team_name" "text", "away_team_abbreviation" "text", "away_team_wins" bigint, "away_team_losses" bigint, "home_team_score" integer, "away_team_score" integer, "game_status" "text", "stage" "text", "picks" "json")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH team_wins AS (
    SELECT
      t.id AS team_id,
      COUNT(CASE WHEN g.home_team_id = t.id AND g.home_team_score > g.away_team_score THEN 1
                 WHEN g.away_team_id = t.id AND g.away_team_score > g.home_team_score THEN 1
                 ELSE NULL END) AS wins,
      COUNT(CASE WHEN g.home_team_id = t.id AND g.home_team_score < g.away_team_score THEN 1
                 WHEN g.away_team_id = t.id AND g.away_team_score < g.home_team_score THEN 1
                 ELSE NULL END) AS losses
    FROM
      teams t
    LEFT JOIN
      games g ON t.id IN (g.home_team_id, g.away_team_id)
    WHERE
      g.status = 'Final' and g.season = '2025'
    GROUP BY
      t.id
  )

  SELECT
    g.id AS game_id,
    g.date,
    home_team.id AS home_team_id,
    home_team.name AS home_team_name,
    home_team.abbreviation AS home_team_abbreviation,
    home_wins.wins AS home_team_wins,
    home_wins.losses AS home_team_losses,
    away_team.id AS away_team_id,
    away_team.name AS away_team_name,
    away_team.abbreviation AS away_team_abbreviation,
    away_wins.wins AS away_team_wins,
    away_wins.losses AS away_team_losses,
    g.home_team_score,
    g.away_team_score,
    g.status AS game_status,  -- Added game status
    g.stage as stage,
    json_agg(json_build_object(
      'pick_id', p.id,
      'picked_team', p.picked_team,
      'correct', p.correct,
      'user_id', p.user_id,
      'confidence_score', p.confidence_score,
      'user_full_name', pr.full_name  -- Added user full name
    )) AS picks
  FROM
    games g
  JOIN
    teams home_team ON g.home_team_id = home_team.id
  JOIN
    teams away_team ON g.away_team_id = away_team.id
  LEFT JOIN
    team_wins AS home_wins ON g.home_team_id = home_wins.team_id
  LEFT JOIN
    team_wins AS away_wins ON g.away_team_id = away_wins.team_id
  LEFT JOIN
    picks p ON p.game_id = g.id
  LEFT JOIN
    public.profiles pr ON p.user_id = pr.id  -- Join to get user full name
  WHERE
    g.date = game_date_v2
  GROUP BY
    g.id, home_team.id, away_team.id, home_wins.wins, home_wins.losses, away_wins.wins, away_wins.losses, g.status
  ORDER BY
    g.date ASC, g.status;
END;
$$;

ALTER FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date", "p_season" integer DEFAULT 2025) RETURNS TABLE("game_id" bigint, "game_date" "date", "home_team_id" bigint, "home_team_name" "text", "home_team_abbreviation" "text", "home_team_wins" bigint, "home_team_losses" bigint, "away_team_id" bigint, "away_team_name" "text", "away_team_abbreviation" "text", "away_team_wins" bigint, "away_team_losses" bigint, "home_team_score" integer, "away_team_score" integer, "game_status" "text", "stage" "text", "picks" "json")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH team_wins AS (
    SELECT
      t.id AS team_id,
      COUNT(CASE WHEN g.home_team_id = t.id AND g.home_team_score > g.away_team_score THEN 1
                 WHEN g.away_team_id = t.id AND g.away_team_score > g.home_team_score THEN 1
                 ELSE NULL END) AS wins,
      COUNT(CASE WHEN g.home_team_id = t.id AND g.home_team_score < g.away_team_score THEN 1
                 WHEN g.away_team_id = t.id AND g.away_team_score < g.home_team_score THEN 1
                 ELSE NULL END) AS losses
    FROM
      teams t
    LEFT JOIN
      games g ON t.id IN (g.home_team_id, g.away_team_id)
    WHERE
      g.status = 'Final' and g.season = p_season
    GROUP BY
      t.id
  )

  SELECT
    g.id AS game_id,
    g.date,
    home_team.id AS home_team_id,
    home_team.name AS home_team_name,
    home_team.abbreviation AS home_team_abbreviation,
    home_wins.wins AS home_team_wins,
    home_wins.losses AS home_team_losses,
    away_team.id AS away_team_id,
    away_team.name AS away_team_name,
    away_team.abbreviation AS away_team_abbreviation,
    away_wins.wins AS away_team_wins,
    away_wins.losses AS away_team_losses,
    g.home_team_score,
    g.away_team_score,
    g.status AS game_status,  -- Added game status
    g.stage as stage,
    json_agg(json_build_object(
      'pick_id', p.id,
      'picked_team', p.picked_team,
      'correct', p.correct,
      'user_id', p.user_id,
      'confidence_score', p.confidence_score,
      'user_full_name', pr.full_name  -- Added user full name
    )) AS picks
  FROM
    games g
  JOIN
    teams home_team ON g.home_team_id = home_team.id
  JOIN
    teams away_team ON g.away_team_id = away_team.id
  LEFT JOIN
    team_wins AS home_wins ON g.home_team_id = home_wins.team_id
  LEFT JOIN
    team_wins AS away_wins ON g.away_team_id = away_wins.team_id
  LEFT JOIN
    picks p ON p.game_id = g.id
  LEFT JOIN
    public.profiles pr ON p.user_id = pr.id  -- Join to get user full name
  WHERE
    g.date = game_date_v2
  GROUP BY
    g.id, home_team.id, away_team.id, home_wins.wins, home_wins.losses, away_wins.wins, away_wins.losses, g.status
  ORDER BY
    g.date ASC, g.status;
END;
$$;

ALTER FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date", "p_season" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_last_5_games_per_team"() RETURNS TABLE("team_id" bigint, "team_name" "text", "opponent_team_id" bigint, "opponent_team_name" "text", "team_score" integer, "opponent_score" integer, "result" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
RETURN QUERY
WITH all_games AS (
    SELECT
      g.id AS game_id,
      g.date,
      g.home_team_id AS home_team_id,
      t_home.name AS home_team_name,
      g.away_team_id AS away_team_id,
      t_away.name AS away_team_name,
      g.home_team_score AS home_team_score,
      g.away_team_score AS away_team_score
    FROM
      games g
    JOIN
      teams t_home ON g.home_team_id = t_home.id
    JOIN
      teams t_away ON g.away_team_id = t_away.id
    WHERE
      g.status = 'Final'
),
ranked_games AS (
    SELECT
      g.id,
      date,
      home_team_id AS team_id,
      t_home.name AS team_name,
      away_team_id AS opponent_team_id,
      t_away.name AS opponent_team_name,
      home_team_score AS team_score,
      away_team_score AS opponent_score,
      ROW_NUMBER() OVER (PARTITION BY home_team_id ORDER BY date DESC) AS rn
    FROM
      games g
    JOIN teams t_home ON g.home_team_id = t_home.id
    JOIN teams t_away ON g.away_team_id = t_away.id
    WHERE g.status = 'Final'

    UNION ALL

    SELECT
      g.id,
      date,
      away_team_id AS team_id,
      t_away.name AS team_name,
      home_team_id AS opponent_team_id,
      t_home.name AS opponent_team_name,
      away_team_score AS team_score,
      home_team_score AS opponent_score,
      ROW_NUMBER() OVER (PARTITION BY away_team_id ORDER BY date DESC) AS rn
    FROM
      games g
    JOIN teams t_home ON g.home_team_id = t_home.id
    JOIN teams t_away ON g.away_team_id = t_away.id
    WHERE g.status = 'Final'
)

SELECT
    ranked_games.team_id,
    ranked_games.team_name,
    ranked_games.opponent_team_id,
    ranked_games.opponent_team_name,
    ranked_games.team_score,
    ranked_games.opponent_score,
    CASE 
      WHEN ranked_games.team_score > ranked_games.opponent_score THEN 'W'
      WHEN ranked_games.team_score < ranked_games.opponent_score THEN 'L'
      ELSE 'D'
    END AS result
FROM
    ranked_games
WHERE
    rn <= 5
ORDER BY
    ranked_games.team_id, ranked_games.date DESC;
END;
$$;

ALTER FUNCTION "public"."get_last_5_games_per_team"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_last_5_games_per_team"("p_season" integer DEFAULT 2025) RETURNS TABLE("team_id" bigint, "team_name" "text", "opponent_team_id" bigint, "opponent_team_name" "text", "team_score" integer, "opponent_score" integer, "result" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
RETURN QUERY
WITH all_games AS (
    SELECT
      g.id AS game_id,
      g.date,
      g.home_team_id AS home_team_id,
      t_home.name AS home_team_name,
      g.away_team_id AS away_team_id,
      t_away.name AS away_team_name,
      g.home_team_score AS home_team_score,
      g.away_team_score AS away_team_score
    FROM
      games g
    JOIN
      teams t_home ON g.home_team_id = t_home.id
    JOIN
      teams t_away ON g.away_team_id = t_away.id
    WHERE
      g.status = 'Final' AND g.season = p_season
),
ranked_games AS (
    SELECT
      g.id,
      date,
      home_team_id AS team_id,
      t_home.name AS team_name,
      away_team_id AS opponent_team_id,
      t_away.name AS opponent_team_name,
      home_team_score AS team_score,
      away_team_score AS opponent_score,
      ROW_NUMBER() OVER (PARTITION BY home_team_id ORDER BY date DESC) AS rn
    FROM
      games g
    JOIN teams t_home ON g.home_team_id = t_home.id
    JOIN teams t_away ON g.away_team_id = t_away.id
    WHERE g.status = 'Final' AND g.season = p_season

    UNION ALL

    SELECT
      g.id,
      date,
      away_team_id AS team_id,
      t_away.name AS team_name,
      home_team_id AS opponent_team_id,
      t_home.name AS opponent_team_name,
      away_team_score AS team_score,
      home_team_score AS opponent_score,
      ROW_NUMBER() OVER (PARTITION BY away_team_id ORDER BY date DESC) AS rn
    FROM
      games g
    JOIN teams t_home ON g.home_team_id = t_home.id
    JOIN teams t_away ON g.away_team_id = t_away.id
    WHERE g.status = 'Final' and g.season = p_season
)

SELECT
    ranked_games.team_id,
    ranked_games.team_name,
    ranked_games.opponent_team_id,
    ranked_games.opponent_team_name,
    ranked_games.team_score,
    ranked_games.opponent_score,
    CASE 
      WHEN ranked_games.team_score > ranked_games.opponent_score THEN 'W'
      WHEN ranked_games.team_score < ranked_games.opponent_score THEN 'L'
      ELSE 'D'
    END AS result
FROM
    ranked_games
WHERE
    rn <= 5
ORDER BY
    ranked_games.team_id, ranked_games.date DESC;
END;
$$;

ALTER FUNCTION "public"."get_last_5_games_per_team"("p_season" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_leaderboard_stats"("p_season" integer DEFAULT NULL::integer, "p_postseason" boolean DEFAULT NULL::boolean) RETURNS TABLE("user_id" "uuid", "full_name" "text", "avatar_url" "text", "total_picks" bigint, "correct_picks" bigint, "total_score" numeric, "accuracy" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    COUNT(pk.id) as total_picks,
    COUNT(pk.id) FILTER (WHERE pk.correct = true) as correct_picks,
    COALESCE(
      SUM(
        CASE 
          WHEN pk.correct = true 
          THEN COALESCE(pk.confidence_score, 1)::NUMERIC
          ELSE 0::NUMERIC
        END
      ),
      0::NUMERIC
    ) as total_score,
    ROUND(
      (COUNT(pk.id) FILTER (WHERE pk.correct = true)::NUMERIC / 
       NULLIF(COUNT(pk.id), 0) * 100), 
      2
    ) as accuracy
  FROM profiles p
  LEFT JOIN picks pk ON p.id = pk.user_id
  LEFT JOIN games g ON pk.game_id = g.id
  WHERE 
    (p_season IS NULL OR g.season = p_season)
    AND g.status = 'Final'
    AND (p_postseason IS NULL OR g.postseason = p_postseason)
  GROUP BY p.id, p.username, p.avatar_url
  HAVING COUNT(pk.id) > 0
  ORDER BY total_score DESC;
END;
$$;

ALTER FUNCTION "public"."get_leaderboard_stats"("p_season" integer, "p_postseason" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_picks_past_record"() RETURNS TABLE("user_id" "uuid", "full_name" "text", "game_date" "date", "correct_picks" bigint, "total_picks" bigint, "accuracy" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH user_picks AS (
      SELECT 
          p.id AS user_id,  -- Rename to user_id to avoid confusion
          p.full_name,
          DATE(g.date) AS game_date,
          COUNT(CASE WHEN pi.correct THEN 1 END) AS correct_picks,
          COUNT(pi.id) AS total_picks,
          ROUND(COUNT(CASE WHEN pi.correct THEN 1 END) * 100.0 / NULLIF(COUNT(pi.id), 0), 1) AS accuracy,
          ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY g.date DESC) AS rn  -- Rank entries for each user
      FROM 
          public.profiles p
      LEFT JOIN 
          public.picks pi ON p.id = pi.user_id
      LEFT JOIN 
          public.games g ON pi.game_id = g.id
      WHERE 
          g.date < CURRENT_DATE  -- Exclude today's games
      GROUP BY 
          p.id, p.full_name, DATE(g.date)
  )

  SELECT 
      user_picks.user_id,   -- Use `user_picks.user_id` explicitly
      user_picks.full_name, -- Use `user_picks.full_name` explicitly
      user_picks.game_date,
      user_picks.correct_picks,
      user_picks.total_picks,
      user_picks.accuracy
  FROM 
      user_picks
  WHERE 
      rn <= 7  -- Get only the top 5 entries per user
  ORDER BY 
      user_picks.user_id, user_picks.game_date DESC;
END;
$$;

ALTER FUNCTION "public"."get_user_picks_past_record"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_picks_past_record"("for_postseason" boolean DEFAULT false, "p_season" integer DEFAULT NULL::integer) RETURNS TABLE("user_id" "uuid", "full_name" "text", "game_date" "date", "correct_picks" bigint, "total_picks" bigint, "accuracy" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH user_picks AS (
      SELECT 
          p.id AS user_id,  -- Rename to user_id to avoid confusion
          p.full_name,
          DATE(g.date) AS game_date,
          COUNT(CASE WHEN pi.correct THEN 1 END) AS correct_picks,
          COUNT(pi.id) AS total_picks,
          ROUND(COUNT(CASE WHEN pi.correct THEN 1 END) * 100.0 / NULLIF(COUNT(pi.id), 0), 1) AS accuracy,
          ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY g.date DESC) AS rn  -- Rank entries for each user
      FROM 
          public.profiles p
      LEFT JOIN 
          public.picks pi ON p.id = pi.user_id
      LEFT JOIN 
          public.games g ON pi.game_id = g.id
      WHERE 
          g.date < CURRENT_DATE  -- Exclude today's games
        AND g.postseason = for_postseason
        AND g.status = 'Final'
        AND (p_season IS NULL OR g.season = p_season)
      GROUP BY 
          p.id, p.full_name, DATE(g.date)
  )

  SELECT 
      user_picks.user_id,   -- Use `user_picks.user_id` explicitly
      user_picks.full_name, -- Use `user_picks.full_name` explicitly
      user_picks.game_date,
      user_picks.correct_picks,
      user_picks.total_picks,
      user_picks.accuracy
  FROM 
      user_picks
  WHERE 
      rn <= 7  -- Get only the top 5 entries per user
  ORDER BY 
      user_picks.user_id, user_picks.game_date DESC;
END;
$$;

ALTER FUNCTION "public"."get_user_picks_past_record"("for_postseason" boolean, "p_season" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_picks_summary"("for_postseason" boolean DEFAULT false, "p_season" integer DEFAULT NULL::integer) RETURNS TABLE("id" "uuid", "full_name" "text", "avatar_url" "text", "correct_picks" bigint, "total_picks" bigint, "accuracy" numeric, "best_team_ids" bigint[], "best_team_accuracy" numeric[], "worst_team_ids" bigint[], "worst_team_accuracy" numeric[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH filtered_picks AS (
    SELECT pc.*
    FROM public.picks pc
    JOIN public.games g ON pc.game_id = g.id
    WHERE g.postseason = for_postseason
      AND g.status = 'Final'
      AND (p_season IS NULL OR g.season = p_season)
  )
  SELECT 
      prof.id,
      prof.full_name,
      prof.avatar_url,
      COUNT(CASE WHEN fp.correct THEN 1 END) AS correct_picks,
      COUNT(fp.id) AS total_picks,
      ROUND(COUNT(CASE WHEN fp.correct THEN 1 END) * 100.0 / NULLIF(COUNT(fp.id), 0), 1) AS accuracy,
      -- top 3 best teams: teams with highest correct picks for this user (ids)
      (
        SELECT ARRAY(
          SELECT team_id FROM (
            SELECT fp2.picked_team AS team_id, SUM(CASE WHEN fp2.correct THEN 1 ELSE 0 END) AS correct_count, COUNT(*) AS total_count
            FROM filtered_picks fp2
            WHERE fp2.user_id = prof.id
            GROUP BY fp2.picked_team
          ) t
          ORDER BY correct_count DESC, team_id ASC
          LIMIT 3
        )
      )::bigint[] AS best_team_ids,
      -- top 3 best teams: accuracy per team (percentage rounded to 1 decimal)
      (
        SELECT ARRAY(
          SELECT ROUND((correct_count::numeric * 100.0) / NULLIF(total_count,0), 1) FROM (
            SELECT fp2.picked_team AS team_id, SUM(CASE WHEN fp2.correct THEN 1 ELSE 0 END) AS correct_count, COUNT(*) AS total_count
            FROM filtered_picks fp2
            WHERE fp2.user_id = prof.id
            GROUP BY fp2.picked_team
          ) t
          ORDER BY correct_count DESC, team_id ASC
          LIMIT 3
        )
      )::numeric[] AS best_team_accuracy,
      -- top 3 worst teams: team ids with highest incorrect picks
      (
        SELECT ARRAY(
          SELECT team_id FROM (
            SELECT fp3.picked_team AS team_id, SUM(CASE WHEN NOT fp3.correct THEN 1 ELSE 0 END) AS incorrect_count, COUNT(*) AS total_count
            FROM filtered_picks fp3
            WHERE fp3.user_id = prof.id
            GROUP BY fp3.picked_team
          ) u
          ORDER BY incorrect_count DESC, team_id ASC
          LIMIT 3
        )
      )::bigint[] AS worst_team_ids,
      -- top 3 worst teams: accuracy per team (percentage of correct picks for that team)
      (
        SELECT ARRAY(
          SELECT ROUND(( (total_count - incorrect_count)::numeric * 100.0) / NULLIF(total_count,0), 1) FROM (
            SELECT fp3.picked_team AS team_id, SUM(CASE WHEN NOT fp3.correct THEN 1 ELSE 0 END) AS incorrect_count, COUNT(*) AS total_count
            FROM filtered_picks fp3
            WHERE fp3.user_id = prof.id
            GROUP BY fp3.picked_team
          ) u
          ORDER BY incorrect_count DESC, team_id ASC
          LIMIT 3
        )
      )::numeric[] AS worst_team_accuracy
  FROM 
      public.profiles prof
  LEFT JOIN 
      filtered_picks fp ON prof.id = fp.user_id
  GROUP BY 
      prof.id, prof.full_name, prof.avatar_url;
END;
$$;

ALTER FUNCTION "public"."get_user_picks_summary"("for_postseason" boolean, "p_season" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_recent_form"("p_user_id" "uuid", "p_season" integer DEFAULT NULL::integer, "p_limit" integer DEFAULT 10) RETURNS TABLE("game_id" bigint, "game_date" "date", "home_team" "text", "away_team" "text", "picked_team" "text", "correct" boolean, "confidence_score" smallint, "points_earned" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.date,
    ht.abbreviation as home_team,
    at.abbreviation as away_team,
    pt.abbreviation as picked_team,
    pk.correct,
    pk.confidence_score,
    CASE 
      WHEN pk.correct = true 
      THEN COALESCE(pk.confidence_score::INTEGER, 1)
      ELSE 0 
    END as points_earned
  FROM picks pk
  JOIN games g ON pk.game_id = g.id
  JOIN teams ht ON g.home_team_id = ht.id
  JOIN teams at ON g.away_team_id = at.id
  JOIN teams pt ON pk.picked_team = pt.id
  WHERE 
    pk.user_id = p_user_id
    AND pk.correct IS NOT NULL
    AND (p_season IS NULL OR g.season = p_season)
  ORDER BY g.date DESC, pk.created_at DESC
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION "public"."get_user_recent_form"("p_user_id" "uuid", "p_season" integer, "p_limit" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "date",
    "home_team_id" bigint,
    "away_team_id" bigint,
    "home_team_score" integer,
    "away_team_score" integer,
    "season" integer,
    "postseason" boolean,
    "period" smallint,
    "status" "text",
    "time" "text",
    "stage" "text"
);

ALTER TABLE "public"."games" OWNER TO "postgres";

ALTER TABLE "public"."games" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."games_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."picks" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "game_id" bigint,
    "picked_team" bigint,
    "correct" boolean,
    "user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "confidence_score" smallint DEFAULT '1'::smallint
);

ALTER TABLE "public"."picks" OWNER TO "postgres";

ALTER TABLE "public"."picks" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."picks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "website" "text",
    CONSTRAINT "username_length" CHECK (("char_length"("username") >= 3))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "conference" "text",
    "division" "text",
    "city" "text",
    "name" "text",
    "full_name" "text",
    "abbreviation" "text"
);

ALTER TABLE "public"."teams" OWNER TO "postgres";

ALTER TABLE "public"."teams" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."teams_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_id_key" UNIQUE ("id");

ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "picks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");

ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "unique_user_game" UNIQUE ("user_id", "game_id");

CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."picks" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');

ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON UPDATE CASCADE;

ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON UPDATE CASCADE;

ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "picks_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "picks_picked_team_fkey" FOREIGN KEY ("picked_team") REFERENCES "public"."teams"("id");

ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "picks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Auth users can update" ON "public"."picks" FOR UPDATE TO "authenticated" USING (true);

CREATE POLICY "Enable delete for users based on user_id" ON "public"."picks" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable insert for authenticated users only" ON "public"."picks" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."games" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."picks" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."teams" FOR SELECT USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT USING (true);

CREATE POLICY "Users can insert games." ON "public"."games" FOR INSERT TO "anon" WITH CHECK (true);

CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));

CREATE POLICY "Users can update own profile." ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));

ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."picks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read games" ON "public"."games" FOR SELECT TO "anon" USING (true);

ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON PROCEDURE "public"."get_games_by_date"(IN "game_date" "date") TO "anon";
GRANT ALL ON PROCEDURE "public"."get_games_by_date"(IN "game_date" "date") TO "authenticated";
GRANT ALL ON PROCEDURE "public"."get_games_by_date"(IN "game_date" "date") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date", "p_season" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date", "p_season" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_games_by_date_v2"("game_date_v2" "date", "p_season" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_last_5_games_per_team"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_last_5_games_per_team"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_last_5_games_per_team"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_last_5_games_per_team"("p_season" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_last_5_games_per_team"("p_season" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_last_5_games_per_team"("p_season" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_leaderboard_stats"("p_season" integer, "p_postseason" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_leaderboard_stats"("p_season" integer, "p_postseason" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leaderboard_stats"("p_season" integer, "p_postseason" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_picks_past_record"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_picks_past_record"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_picks_past_record"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_picks_past_record"("for_postseason" boolean, "p_season" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_picks_past_record"("for_postseason" boolean, "p_season" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_picks_past_record"("for_postseason" boolean, "p_season" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_picks_summary"("for_postseason" boolean, "p_season" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_picks_summary"("for_postseason" boolean, "p_season" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_picks_summary"("for_postseason" boolean, "p_season" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_recent_form"("p_user_id" "uuid", "p_season" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_recent_form"("p_user_id" "uuid", "p_season" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_recent_form"("p_user_id" "uuid", "p_season" integer, "p_limit" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";

GRANT ALL ON SEQUENCE "public"."games_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."games_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."games_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."picks" TO "anon";
GRANT ALL ON TABLE "public"."picks" TO "authenticated";
GRANT ALL ON TABLE "public"."picks" TO "service_role";

GRANT ALL ON SEQUENCE "public"."picks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."picks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."picks_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";

GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teams_id_seq" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

RESET ALL;

