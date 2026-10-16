import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log('Refresh schedules function!')

Deno.serve(async req => {
  // MY_* lets a locally served function target another project;
  // deployed functions get SUPABASE_* injected by the platform
  const supabase = createClient(
    Deno.env.get('MY_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      '',
  )

  // ?full=1 loads the whole season, e.g. right before opening night;
  // otherwise only the next 30 days are refreshed
  const full = new URL(req.url).searchParams.get('full') === '1'
  const dates = []
  if (!full) {
    for (let i = 0; i <= 30; i++) {
      dates.push(formatDateToString(i))
    }
  }

  const season = currentSeason()
  const games = await fetchGamesFromDates(season, dates)
  console.log(`found ${games.length} games on balldontlie api for ${season}`)

  // One upsert both inserts new games and refreshes existing ones
  const toUpsert = games.map(game => ({
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
    postseason: game.postseason,
  }))

  const { error } = await supabase.from('games').upsert(toUpsert)
  if (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  console.log(`upserted ${toUpsert.length} games`)

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
// NBA_SEASON overrides it, e.g. to backfill an older season.
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
  const games = []
  const params = [
    `seasons[]=${season}`,
    ...dates.map(d => `dates[]=${d}`),
    'per_page=100',
  ].join('&')
  while (true) {
    let url = `https://api.balldontlie.io/v1/games?${params}`
    if (cursor) {
      url = url.concat(`&cursor=${cursor}`)
    }
    const response = await fetch(url, {
      headers: { Authorization: Deno.env.get('BALLDONTLIE_API_KEY') ?? '' },
    })
    // The free tier allows 5 requests a minute; wait and retry the page
    if (response.status === 429) {
      console.log('rate limited, retrying in 15s')
      await new Promise(resolve => setTimeout(resolve, 15000))
      continue
    }
    if (!response.ok) {
      throw new Error(
        `balldontlie ${response.status}: ${await response.text()}`,
      )
    }
    const { data, meta } = await response.json()

    games.push(...data)
    cursor = meta.next_cursor
    if (cursor === undefined || cursor === null) break
  }

  return games
}
