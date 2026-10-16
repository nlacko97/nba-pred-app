// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log('Hello from Functions!')

// Look back two days so a game that was not Final on the first run
// (late overtime, delayed cron) still gets scored on the next one
const LOOKBACK_DAYS = 2

Deno.serve(async req => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const dates = []
  for (let i = 1; i <= LOOKBACK_DAYS; i++) {
    dates.push(formatDateToString(-i))
  }

  const games = await fetchGamesFromDates(currentSeason(), dates)
  console.log(`found ${games.length} games`)
  const toUpsert = []
  for (const game of games) {
    toUpsert.push({
      id: game.id,
      date: game.date,
      home_team_id: game.home_team.id,
      away_team_id: game.visitor_team.id,
      season: game.season,
      period: game.period,
      time: game.time,
      status: game.status,
      home_team_score: game.home_team_score,
      away_team_score: game.visitor_team_score,
    })
  }
  const { error: gamesError } = await supabase.from('games').upsert(toUpsert)
  if (gamesError) {
    console.error(gamesError)
  }

  const { data, error } = await supabase
    .from('games')
    .select('*, home_team:home_team_id(*),away_team:away_team_id(*),picks(*)')
    .in('date', dates)
    .order('date', { ascending: true })
  if (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const picksToUpdate = []
  for (const game of data) {
    // Only score finished games; in-progress or postponed ones wait
    if (game.status !== 'Final') {
      continue
    }
    const winner =
      game.home_team_score > game.away_team_score
        ? game.home_team
        : game.away_team
    for (const pick of game.picks) {
      pick.correct = pick.picked_team === winner.id
      picksToUpdate.push(pick)
    }
  }
  const { error: picksError } = await supabase
    .from('picks')
    .upsert(picksToUpdate)
  if (picksError) {
    console.error(picksError)
  }
  console.log(`updating ${picksToUpdate.length} picks`)

  // Bonuses (upset) are recomputed from scratch, so rerunning is safe
  const { data: bonusChanges, error: bonusError } = await supabase.rpc(
    'apply_pick_bonuses',
    { p_dates: dates },
  )
  if (bonusError) {
    console.error(bonusError)
  }
  console.log(`bonuses changed on ${bonusChanges ?? 0} picks`)

  // Badges for each scored day, oldest first; awards are idempotent
  for (const date of [...dates].sort()) {
    const { data: awarded, error: badgeError } = await supabase.rpc(
      'award_badges',
      { p_date: date },
    )
    if (badgeError) {
      console.error(badgeError)
      continue
    }
    console.log(`badges for ${date}: ${JSON.stringify(awarded)}`)
  }

  return new Response(JSON.stringify('success\n'), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function formatDateToString(daysToAdd = 0) {
  const date = new Date()
  date.setDate(date.getDate() + daysToAdd)
  return date.toISOString().split('T')[0]
}

// A season is named after the year it tips off: Sep 2026 – Aug 2027 is 2026.
// NBA_SEASON overrides it, e.g. to rescore an older season.
function currentSeason() {
  const override = Deno.env.get('NBA_SEASON')
  if (override) return parseInt(override)
  const now = new Date()
  return now.getUTCMonth() >= 8
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1
}

async function fetchGamesFromDates(season, dates) {
  let cursor = undefined
  let counter = 1
  const games = []
  const datesParam = dates.map(d => `dates[]=${d}`).join('&')
  do {
    let url = `https://api.balldontlie.io/v1/games?seasons[]=${season}&${datesParam}&per_page=100`
    if (cursor) {
      url = url.concat(`&cursor=${cursor}`)
    }
    const response = await fetch(url, {
      headers: { Authorization: Deno.env.get('BALLDONTLIE_API_KEY') ?? '' },
    })
    const { data, meta } = await response.json()

    cursor = meta.next_cursor
    games.push(...data)

    counter++
  } while (cursor !== undefined && counter < 30)

  return games
}
