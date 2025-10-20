import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log('Refresh schedules function!')

Deno.serve(async req => {
  // LOCAL CLIENT
  const supabase = createClient(
    Deno.env.get('MY_SUPABASE_URL') ?? '',
    Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  // DEPLOYED CLIENT
  // const supabase = createClient(
  //   Deno.env.get('SUPABASE_URL') ?? '',
  //   Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  // )

  const dates = []
  for (let i = 0; i <= 30; i++) {
    dates.push(formatDateToString(i))
  }

  const games = await fetchGamesFromDates(dates)
  console.log(`found ${games.length} games on balldontlie api`)
  const foundGamesIds = games.map(g => parseInt(g.id))
  console.log(
    `found ${new Set(foundGamesIds).size} unique game ids on balldontlie api`,
  )

  const { data: gamesOnServer, error } = await supabase
    .from('games')
    .select('id')
    .in('id', [])
  if (error) {
    console.error(error)
  }
  console.log(gamesOnServer)
  console.log(`found ${gamesOnServer?.length} games on server`)
  const gameIdsOnServer = gamesOnServer.map(g => g.id)

  const missingIds = foundGamesIds.filter(idw => {
    if (!gameIdsOnServer.includes(idw)) {
      console.log(`checking for ${idw}`)
      console.log(!gameIdsOnServer.includes(idw))
    }

    return !gameIdsOnServer.includes(idw)
  })

  console.log(`found ${missingIds.length} missing ids: ${missingIds.join(',')}`)

  const missingGames = games.filter(g => missingIds.includes(g.id))
  for (const missingGame of missingGames) {
    console.log('inserting')
    console.log(missingGame)

    const response = await supabase.from('games').insert({
      id: missingGame.id,
      date: missingGame.date,
      home_team_id: missingGame.home_team.id,
      away_team_id: missingGame.visitor_team.id,
      season: missingGame.season,
      period: missingGame.period,
      time: missingGame.time,
      status: missingGame.status,
      home_team_score: missingGame.home_team_score,
      away_team_score: missingGame.visitor_team_score,
      postseason: missingGame.postseason,
    })
    console.log(response)
  }

  console.log(`inserted ${missingGames.length} games`)

  // upsert found game data to update information
  const toUpsert = []
  const gamesToUpdate = games.filter(g => gameIdsOnServer.includes(g.id))
  for (const game of gamesToUpdate) {
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
      postseason: game.postseason,
    })
  }
  await supabase.from('games').upsert(toUpsert)
  console.log(`updated ${toUpsert.length} existing games`)

  return new Response(JSON.stringify('success\n'), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function formatDateToString(daysToAdd = 0) {
  const date = new Date()
  date.setDate(date.getDate() + daysToAdd)
  return date.toISOString().split('T')[0]
}

async function fetchGamesFromDates(dates) {
  let cursor = undefined
  const games = []
  const datesParam = dates.map(d => `dates[]=${d}`).join('&')
  do {
    console.log('making request')
    let url = `https://api.balldontlie.io/v1/games?seasons[]=2025&${datesParam}&per_page=100`
    if (cursor) {
      url = url.concat(`&cursor=${cursor}`)
    }
    console.log(url)
    const response = await fetch(url, {
      headers: { Authorization: Deno.env.get('BALLDONTLIE_API_KEY') ?? '' },
    })
    const { data, meta } = await response.json()

    cursor = meta.next_cursor
    games.push(...data)
  } while (cursor !== undefined)

  return games
}
