# 2026–27 feature plan — handoff

Implementation plan for the next round of engagement features. Each workstream
(WS) is written to be picked up by a separate agent: it lists the goal, the
rules, the data model, the files it owns, the steps, and how to check it is
done. Read **Context** and **WS0** first; everything else depends on them.

| WS  | Feature                                         | Depends on        | Size     |
| --- | ----------------------------------------------- | ----------------- | -------- |
| 0   | Foundation: schema in repo, one points source   | —                 | 0.5 day  |
| 1   | Weekly & monthly titles                         | WS0               | 1.5 days |
| 2   | Badges (13) and streaks                         | WS0, WS1¹, WS3¹   | 3 days   |
| 3   | Upset bonus (< 30% win probability)             | WS0               | 1.5 days |
| 4   | Picks: Lock of the Night, Margin Call, Prop     | WS0, WS3²         | 3 days   |
| 5   | Standings & player page: race, history, scouting| WS0, WS3³         | 3 days   |

¹ Only the Weekly/Monthly Crown and Upset Hunter badges need them; the badge
engine and the other 10 badges can be built first.
² WS3 and WS4 both edit the scoring function and `GameTicket.vue`; land WS3 first.
³ Only the "favorite vs underdog" card in the scouting report needs WS3.

---

## Context

**Stack.** Vue 3 (`<script setup>`, JavaScript), Pinia, Vue Router, Tailwind,
Supabase (Postgres + edge functions in Deno). Follow `AGENTS.md`: single quotes,
no semicolons, `npm run lint` and `npm run build` after changes, no test runner.
Use `npx prettier --no-semi --single-quote --arrow-parens avoid` on edge
functions (Prettier only covers `src/`).

**Dates and seasons.** Always use `src/lib/season.js`:
`gameDayIso()` (US game day, rolls over at 6am ET), `addDays`, `seasonForDate`,
`CURRENT_SEASON`, `seasonLabel`. A season is named after its tip-off year
(2026–27 = `2026`). Game dates are `YYYY-MM-DD` strings in US time. Edge
functions have their own `currentSeason()`; keep them in sync.

**Scoring today.** A correct pick scores its `confidence_score` (1–3). All-Star
market picks score `confidence_score × multiplier`. Each game day a user gets a
confidence budget of `games + markets + 2` (`src/stores/games.js`,
`maxConfidencePerDay`). Picks lock at tip-off (client-side check only).
`supabase/functions/update-games-and-picks` scores the last 2 US days, only
`status = 'Final'` games, and is run by pg_cron each morning.

**Data sources.**

- Schedule and scores: balldontlie (`refresh-schedule`, daily 30-day window;
  `?full=1` for a whole season; free tier is rate-limited, the function retries).
- NBA Cup stage: ESPN scoreboard notes, written to `games.stage` by
  `refresh-schedule` (`?stages=1&days=60` to backfill).
- Odds, win probability, standings, leaders: ESPN public API, currently fetched
  **in the browser** (`src/lib/insights/espnProvider.js`).
- **ESPN returns 403 to server-side requests without a browser-like
  `User-Agent`.** Every edge function call to ESPN must send one (see
  `fetchCupStages` in `refresh-schedule`).

**Live schema (as of 2026-10-16).**

- `games`: id, date, season, postseason, home_team_id, away_team_id,
  home_team_score, away_team_score, period, time, status (ISO tip time until it
  starts, then quarter text, then `Final`), stage, created_at.
- `picks`: id, user_id, game_id, picked_team, confidence_score, correct,
  created_at, updated_at.
- `profiles`: id, full_name, username, avatar_url, website, updated_at.
- `teams`: id, name, full_name, abbreviation, city, conference, division.
- `all_star_markets` / `all_star_market_options` / `all_star_picks`: see
  `supabase/migrations/202602130001_all_star_markets.sql`.
- RPCs used by the app: `get_games_by_date_v2(game_date_v2, p_season)`,
  `get_last_5_games_per_team(p_season)`,
  `get_leaderboard_stats(p_season, p_postseason)` → user_id, full_name,
  avatar_url, total_picks, correct_picks, total_score, accuracy,
  `get_user_picks_past_record(p_season, for_postseason)` → per user per
  game_date: total_picks, correct_picks, accuracy.
- **Only the All-Star tables are in `supabase/migrations/`.** The tables above
  and every RPC exist only in the live database. WS0 fixes this.

**Design system ("The Pick Sheet").** Tokens in `src/index.css` (`--c-paper`,
`--c-card`, `--c-ink`, `--c-muted`, `--c-accent`, `--c-win`, `--c-loss`,
`--c-gold`, `--c-court`) with a dark "Night Edition". Square corners, 1.5px ink
borders, `display` (Big Shoulders Display) for headings and numbers, `label`
for small caps. Reuse `.sheet`, `.seg`, `.label`, `.display`, `.num`, `RailPanel.vue`.
Components `NavBar.vue`, `PerformanceChart.vue`, `TeamPerformance.vue` and
`StarRating.vue` are from the old design and unused; reuse ideas, not markup.

---

## WS0 — Foundation (do first, one agent)

**Goal.** Get the live schema into version control and give every feature one
place that defines "how many points did this pick score".

1. `npx supabase db pull` into a baseline migration
   (`supabase/migrations/202610160000_baseline.sql`). Commit it unchanged so
   later diffs are reviewable. If `db pull` needs Docker and it is not
   available, dump the definitions with `pg_get_functiondef` from the SQL
   editor and commit them.
2. Add `picks.bonus_points smallint not null default 0` and
   `picks.bonus_reasons text[] not null default '{}'`.
3. Create view `public.pick_points` — the single source for all scoring:
   `user_id, pick_id, game_id, game_date, season, postseason, stage,
   confidence_score, correct, bonus_points, points` where
   `points = case when correct then confidence_score + bonus_points else 0 end`
   (WS4 extends this for the Lock of the Night penalty). Union in All-Star
   picks (`confidence_score × multiplier`, bonus 0) with `game_id null` and a
   `source` column (`'game' | 'market'`).
4. Rewrite `get_leaderboard_stats` and `get_user_picks_past_record` on top of
   `pick_points` with identical output columns. `total_score` must match the
   old numbers for 2025 exactly — compare before and after.
5. Move the All-Star merge out of `src/stores/leaderboardStats.js`
   (`mergeAllStarStats`) and `src/stores/dailyResults.js` once the RPCs include
   market points, so the client stops double-counting logic.
6. Make picks lock server-side: an RLS policy or trigger on `picks` that
   rejects insert/update/delete when the game's tip time has passed. The
   client check alone is bypassable.

**Done when** the 2025–26 leaderboard shows the same totals as before,
`pick_points` exists, and a pick on a started game is rejected by the database.

---

## WS1 — Weekly & monthly titles

**Goal.** Short competitions inside the season so late joiners and players who
had a bad month still have something to win.

**Rules.**

- Week = Monday–Sunday by US game day (matches the day strip). Week 1 is the
  week containing opening night (2026-10-19 → 10-25).
- Month = calendar month by US game day. October 2026 is a short month (10/20–31)
  — still awarded.
- Score = sum of `pick_points.points` in the period (game and market picks).
- Rank ties: higher accuracy, then fewer picks. A tie on all three shares the
  rank; every rank-1 player gets the crown.
- Titles awarded to ranks 1–3; only rank 1 earns the Weekly/Monthly Crown badge.
- Postseason weeks count; the regular-season/postseason filter does not apply to
  periods.

**Data model.**

```sql
create table public.period_awards (
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
```

- `get_period_leaderboard(p_start date, p_end date)` → same columns as
  `get_leaderboard_stats` plus `rank`.
- `close_periods()` — idempotent: for every week/month that has ended (by US
  game day) and has no rows in `period_awards`, insert the top 3. Schedule with
  pg_cron daily at 13:00 UTC (after the morning scoring run); it is a no-op on
  most days.

**Frontend.**

- `src/lib/season.js`: add `weekStart(iso)`, `weekNumber(iso, season)`,
  `monthStart(iso)`, `periodRange(type, iso)`.
- `src/stores/leaderboardStats.js`: add `mode` (`'season' | 'week' | 'month'`)
  and `periodStart`; fetch via `get_period_leaderboard`; cache per key.
- `LeaderboardView.vue` + `FilterControls.vue`: a `Season | Week | Month`
  segment. New `PeriodNavigator.vue`: `‹ Week 3 · Nov 2–8 ›`, no navigation
  past the current period. The podium and `LeaderboardCard` are reused as-is.
  The current, unfinished period shows "Live" next to the title.
- `GamesView.vue` rail: on the first game day after a period closes, a
  `RailPanel` "Week 2 champion — Name, 31 pts" (from `period_awards`).
- `UserView.vue`: crowns count ("3× weekly champion") — WS2 renders this as badges.

**Files owned.** `supabase/migrations/*_period_awards.sql`, `src/lib/season.js`
(new helpers only), `src/stores/leaderboardStats.js`, `LeaderboardView.vue`,
`FilterControls.vue`, new `PeriodNavigator.vue`, `GamesView.vue` (rail only).

**Done when** the leaderboard switches between season/week/month with correct
totals (spot-check one user by hand in SQL), past weeks are browsable, and
running `close_periods()` twice writes each period's top 3 exactly once.

---

## WS2 — Badges and streaks

**Goal.** Collectible achievements on the player page and the leaderboard that
reward both skill and showing up.

**Design.** Initial artwork for all 13 badges is in `src/assets/badges/*.svg`;
open `docs/badges-preview.html` through the dev server
(`http://localhost:5173/docs/badges-preview.html`) to see the full set on light
and dark backgrounds. The shape tells the family:

- **Night** (round stamp, accent orange): one-night feats.
- **Run** (hexagon, court blue): streaks and consistency.
- **Title** (crest, gold): periods and competitions.

Each badge is a cream sticker with an ink outline and an ink ribbon carrying the
name, so it works on both themes without recolouring. The SVGs use the Big
Shoulders Display font for text: render them **inline** (a `BadgeIcon.vue` that
imports the SVG source with `?raw`, or ports the markup), because an `<img>`
cannot load web fonts and falls back to Impact. Unearned badges render with
`filter: grayscale(1); opacity: .35` plus a progress line ("7 / 10").

**Badges.**

| Slug             | Family | Earned when                                                                                       | Repeatable            |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------- | --------------------- |
| `perfect-night`  | Night  | Every pick correct on a game day, at least 4 game picks                                           | Yes, once per night   |
| `all-in`         | Night  | 3+ picks at maximum confidence (3) all correct on one game day                                    | Yes, once per night   |
| `buzzer-beater`  | Night  | Correct pick in a game decided by ≤ 3 points or in overtime (`period > 4`)                        | Yes, once per night   |
| `contrarian`     | Night  | Correct pick on the side ≤ 25% of pickers chose (min. 8 pickers on that game)                     | Yes, once per night   |
| `hot-hand`       | Run    | 10 correct game picks in a row (ordered by tip time, then game id)                                | Yes, per streak       |
| `iron-man`       | Run    | At least one pick on 30 consecutive game days (days without NBA games don't break it)             | Once per season       |
| `oracle`         | Run    | ≥ 70% accuracy in a calendar month with ≥ 40 game picks                                           | Once per month        |
| `team-whisperer` | Run    | 10 correct picks in a row *on the same team* (only picks where you took that team count)          | Once per team/season  |
| `upset-hunter`   | Run    | 5 correct upset picks (< 30% pre-tip win probability, see WS3) in a season                        | Once per season       |
| `weekly-crown`   | Title  | Rank 1 in a week (WS1)                                                                            | Yes, per week         |
| `monthly-crown`  | Title  | Rank 1 in a month (WS1)                                                                           | Yes, per month        |
| `cup-crusher`    | Title  | Most points across NBA Cup games (`games.stage ilike 'NBA Cup%'`) once the Cup final is Final     | Once per season       |
| `climber`        | Title  | Rise 10+ places on the season leaderboard between two Mondays (both ranks among users with ≥ 20 picks) | Yes, per week   |

Streak displays (not badges): **current correct streak** and **current
daily-pick streak**, shown as a small flame + number on `LeaderboardCard` and the
player page.

**Data model.**

```sql
create table public.badges (
  slug text primary key,
  name text not null,
  description text not null,
  family text not null check (family in ('night', 'run', 'title')),
  sort_order int not null
);

create table public.user_badges (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  badge_slug text not null references public.badges (slug),
  season int not null,
  earned_on date not null,          -- US game day it was earned
  award_key text not null,          -- e.g. 'perfect-night:2026-10-20', 'iron-man:2026', 'team-whisperer:2026:BOS'
  context jsonb not null default '{}', -- e.g. { "game_id": 123, "streak": 10 }
  seen_at timestamptz,              -- null = show the "new badge" moment
  created_at timestamptz not null default now(),
  unique (user_id, badge_slug, award_key)
);
```

Seed `badges` with the 13 rows above. RLS: everyone can read; only the service
role writes; users may update `seen_at` on their own rows.

**Engine.** One SQL function per badge, `award_<slug>(p_date date)`, each an
idempotent `insert … on conflict do nothing`, and `award_badges(p_date date)`
calling them all. Call it from `update-games-and-picks` for each scored date,
after picks are scored. Title badges (`weekly-crown`, `monthly-crown`) are
awarded inside WS1's `close_periods()`; `climber` runs on Mondays; `cup-crusher`
runs when the Cup championship game is Final. A one-off backfill call for every
date since opening night must produce the same rows as the nightly runs.

RPCs for the UI: `get_user_badges(p_user_id, p_season)` (earned rows + counts
per slug + progress toward unearned ones: current streaks, upset count, best
team run) and `get_streaks(p_season)` (user_id, correct_streak, day_streak) for
the leaderboard.

**Frontend.**

- New `BadgeIcon.vue` (inline SVG, `size` prop, `locked` prop).
- New `BadgeShelf.vue` on `UserView.vue`: three rows by family, earned first,
  `×3` counter for repeats, tap for name/description/date earned.
- `LeaderboardCard.vue`: up to 3 most recent badge icons (24px) + streak flame.
- `GamesView.vue`: when the signed-in user has rows with `seen_at is null`,
  show a "New badge" `RailPanel` with the badge at 96px; dismiss sets `seen_at`.

**Files owned.** `supabase/migrations/*_badges.sql`,
`update-games-and-picks` (one call added at the end — coordinate with WS3/WS4),
`src/assets/badges/`, new `BadgeIcon.vue`, `BadgeShelf.vue`, new
`src/stores/badges.js`, `LeaderboardCard.vue`, `UserView.vue` (shelf section
only), `GamesView.vue` (rail panel only).

**Done when** a backfill over 2025–26 awards plausible counts (sanity check:
Perfect Nights are rare, Buzzer Beaters common), rerunning awards nothing new,
and the shelf renders correctly in light and dark mode at 375px width.

---

## WS3 — Upset bonus

**Goal.** Reward correct calls on real underdogs: **+1 point** when you pick a
team whose pre-tip win probability is **under 30%** and it wins.

**Rules.**

- Probability source: ESPN's predictor (`/summary?event=<id>` →
  `predictor.homeTeam.gameProjection`, away = 100 − home).
- The value that counts is the **last snapshot before tip-off**; it never
  changes after the game starts.
- The bonus is flat +1 (not multiplied by confidence), added to
  `picks.bonus_points`, with `'upset'` in `bonus_reasons`.
- No snapshot → no bonus (never guess).
- Enabled from a configurable start date (`app_settings.upset_bonus_from`) so it
  can be announced before it counts.

**Data model.** On `games`: `espn_event_id text`, `home_win_prob numeric(5,2)`,
`win_prob_at timestamptz`. A tiny `app_settings (key text primary key, value
jsonb)` table if one does not exist after WS0.

**Backend.**

1. `refresh-schedule`: generalize `tagCupGames` into `syncEspnMeta` that also
   writes `espn_event_id` (same scoreboard fetch, same date + home team match).
2. New edge function `snapshot-win-probs`: selects games with a tip time in the
   next 36 hours that have not started; fetches each summary (with the
   User-Agent header, ≤ 8 in parallel); updates `home_win_prob` and
   `win_prob_at`. pg_cron every 30 minutes.
3. `update-games-and-picks`: when scoring a Final game, compute the upset bonus
   per pick (picked team's probability < 30, correct, game date ≥ the start
   setting) and write `bonus_points` / `bonus_reasons`. Re-scoring must be
   idempotent (recompute, don't add).

**Frontend.**

- Load `home_win_prob` through `get_games_by_date_v2` (add the column) and
  prefer it over the browser ESPN fetch for the probability bar, so what users
  see is what is scored.
- `GameTicket.vue`: before tip, an "UPSET +1" tag on the side under 30%; after
  Final, "+1 upset" next to the user's points if earned.
- "How it works" panel in `GamesView.vue`: add the rule.

**Files owned.** migration `*_upset_bonus.sql`, `refresh-schedule`
(`syncEspnMeta`), new `snapshot-win-probs`, `update-games-and-picks` (bonus
step), `get_games_by_date_v2`, `GameTicket.vue` (lines + result areas),
`GamesView.vue` (how-it-works text).

**Done when** tomorrow's games get probabilities through the day, values stop
changing at tip, and a test pick on a < 30% winner scores `confidence + 1` on
the leaderboard (via `pick_points`).

---

## WS4 — New pick mechanics

### 4a. Lock of the Night

One pick per game day can be marked as your **Lock**: correct → its points are
**doubled** (confidence × 2, bonuses not doubled); wrong → **−1 point**. It adds
a nightly decision without touching the confidence budget.

- Data: `picks.is_lock boolean not null default false`; a trigger enforces at
  most one lock per user per game day and rejects moving the lock once either
  the old or the new game has tipped.
- Scoring: extend `pick_points.points` →
  `case when correct then confidence_score * (1 + is_lock::int) + bonus_points
  when correct = false and is_lock then -1 else 0 end`.
- UI: a lock toggle on the user's own pick in `GameTicket.vue`; the locked
  ticket gets a padlock stamp; the confidence panel shows "Lock: BOS".

### 4b. Margin Call

An optional add-on to any pick: predict the winning margin bucket — **1–5**,
**6–10**, or **11+**. Right winner and right bucket → **+1** (`'margin'` in
`bonus_reasons`). Overtime games count as 1–5 regardless of the final margin.

- Data: `picks.margin_bucket smallint check (margin_bucket in (1, 2, 3))`, null =
  no call.
- Scoring: in `update-games-and-picks`, alongside the upset bonus.
- UI: three small buttons under the confidence selector after a team is picked;
  results show the actual margin and whether the call hit.

### 4c. Prop of the Night (automatic)

Every game day gets one extra yes/no market generated from real data: the
**over/under total of that night's closest game** (ESPN `odds.overUnder` of the
game whose win probability is nearest 50%). It resolves automatically from the
final score.

- Data: reuse the All-Star market tables with `category = 'nightly_prop'`,
  `multiplier = 1`, two options (Over / Under), `lock_at` = tip time.
- Backend: `refresh-schedule` creates tomorrow's prop once odds exist
  (idempotent on `slug = 'prop-<date>'`); `update-games-and-picks` resolves it
  (`winning_option_id`, `status = 'resolved'`, `correct` on picks). A push (total
  exactly on the line, only possible with whole-number lines) voids it: no points.
- **Pitfall:** `isAllStarWeekend` in `src/stores/games.js` is currently "any
  market exists today" and adds +1 confidence. Change it to check
  `category !== 'nightly_prop'` (or an explicit flag), or every night becomes
  All-Star weekend.
- UI: `AllStarBoard.vue` renders markets generically already; add a compact
  "Prop of the night" variant (one row, two options) above the games list.

**Files owned.** migration `*_pick_mechanics.sql`, `pick_points` view,
`update-games-and-picks` (lock/margin/prop resolution), `refresh-schedule` (prop
creation), `src/stores/games.js` (submit lock/margin, `isAllStarWeekend`),
`GameTicket.vue`, `ConfidenceSelector.vue`, `AllStarBoard.vue`.

**Done when** each mechanic scores correctly on a few hand-made cases in a local
or staging database (correct/wrong lock, margin hit/miss, prop over/under/push)
and the confidence budget is unchanged.

---

## WS5 — Standings and player page

### 5a. Season race (Standings page)

A line chart of **cumulative points by game day** for the top 5 plus the
signed-in user, and **rank movement** on every leaderboard row (▲3 / ▼1 since
last Monday).

- RPC `get_points_timeline(p_season, p_postseason)` → user_id, game_date,
  points, cumulative_points, rank_on_date. Compute rank movement from the row
  for the last Monday.
- UI: new `SeasonRace.vue` above the field list in `LeaderboardView.vue`, using
  `chart.js` / `vue-chartjs` (already dependencies). Lines in muted ink, the
  leader in gold, "you" in accent; label line ends with names instead of a
  legend. Tap a line to highlight it. Works at 375px (the chart scrolls
  horizontally if needed; the page does not).
- `LeaderboardCard.vue`: the movement arrow next to rank.

### 5b. Pick history (player page)

A **season calendar** on `UserView.vue`: one square per game day, shaded by
points that night (0 → paper, max → accent), Monday-first weeks like the day
strip. Tapping a day lists that night's picks: matchup, team picked, confidence,
result, bonuses (and lock/margin once WS4 lands). Filters: team, result.

- RPC `get_user_pick_history(p_user_id, p_season)` → one row per pick with game
  info. **Only games that have tipped** may be returned for users other than the
  caller, so future picks are never exposed.
- New `PickCalendar.vue` and `PickHistoryList.vue`.

### 5c. Scouting report (player page)

Cards that explain *how* someone picks:

- **Trusts / Blind spot:** best and worst teams to pick *for* and *against*
  (e.g. "BOS 14–3 when picking them", "2–9 picking against DEN"), min. 5 picks.
- **Confidence calibration:** hit rate at confidence 1, 2 and 3 as three bars,
  with a one-line read ("Your 3s hit 71% — trust them more").
- **Home vs away** and **favorite vs underdog** splits (the latter needs WS3's
  stored probabilities; hide it until they exist).
- RPC `get_user_scouting(p_user_id, p_season)` returning the aggregates; the
  existing `best_team_ids` / `worst_team_ids` logic can move here.
- New `ScoutingReport.vue`, built from `RailPanel`-style sheets.

**Files owned.** `LeaderboardView.vue` (race section only), `LeaderboardCard.vue`
(movement arrow only — coordinate with WS2), `UserView.vue` (history and
scouting sections — coordinate with WS2's shelf), new components above,
migration `*_player_insights.sql`.

**Done when** the race chart matches `get_leaderboard_stats` totals on the
latest day, the calendar shows the right points for a spot-checked night, and
another user's not-yet-started picks never appear.

---

## Merge order and shared files

1. **WS0** alone.
2. **WS1**, **WS3** and **WS5** in parallel (separate branches).
3. **WS4** after WS3 (both change scoring and `GameTicket.vue`).
4. **WS2**: build the engine and the 10 badges without dependencies in
   parallel with step 2; add `weekly-crown`, `monthly-crown` and `upset-hunter`
   after WS1 and WS3 merge.

Files touched by more than one workstream — keep edits to the named section and
rebase before merging:

| File                                         | Workstreams         |
| -------------------------------------------- | ------------------- |
| `supabase/functions/update-games-and-picks`  | WS2, WS3, WS4       |
| `supabase/functions/refresh-schedule`        | WS3, WS4            |
| `src/components/GameTicket.vue`              | WS3, WS4            |
| `src/components/LeaderboardCard.vue`         | WS2, WS5            |
| `src/views/UserView.vue`                     | WS2, WS5            |
| `src/views/GamesView.vue`                    | WS1, WS2, WS3       |

Every workstream: deploy edge functions only after review
(`npx supabase functions deploy <name>`), push to a branch for a Cloudflare
preview before merging to `main`, and announce scoring changes to players before
they take effect.
