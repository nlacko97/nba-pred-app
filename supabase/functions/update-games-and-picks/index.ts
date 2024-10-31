// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log('Hello from Functions!')

Deno.serve(async req => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const games = await fetchGamesFromYesterday()
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
  const upsertResponse = await supabase.from('games').upsert(toUpsert)
  // console.log(upsertResponse)

  let { data } = await supabase
    .from('games')
    .select('*, home_team:home_team_id(*),away_team:away_team_id(*),picks(*)')
    .eq('date', formatYesterdayToDateString())
    .order('date', { ascending: true })

  const picksToUpdate = []
  for (const game of data) {
    if (game.home_team_score === 0 && game.away_team_score === 0) {
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
  const upsertPicksResponse = await supabase.from('picks').upsert(picksToUpdate)
  console.log(`updating ${picksToUpdate.length} picks`)

  return new Response(JSON.stringify('success\n'), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function formatYesterdayToDateString() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

async function fetchGamesFromYesterday() {
  let cursor = undefined
  let counter = 1
  const games = []
  do {
    let url = `https://api.balldontlie.io/v1/games?seasons[]=2024&dates[]=${formatYesterdayToDateString}&per_page=100`
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
