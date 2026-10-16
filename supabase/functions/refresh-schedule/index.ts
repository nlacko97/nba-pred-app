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
  // otherwise only the next 30 days are refreshed.
  // ?stages=1&days=60 skips balldontlie and only tags NBA Cup games.
  const params = new URL(req.url).searchParams
  const full = params.get('full') === '1'
  const stagesOnly = params.get('stages') === '1'
  const days = parseInt(params.get('days') ?? '30')

  const dates = []
  for (let i = 0; i <= days; i++) {
    dates.push(formatDateToString(i))
  }

  if (!stagesOnly) {
    const upsertError = await refreshGames(supabase, full ? [] : dates)
    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const cup = await tagCupGames(supabase, dates)
  console.log(`NBA Cup: ${JSON.stringify(cup)}`)

  return new Response(JSON.stringify({ success: true, cup }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function refreshGames(supabase, dates) {
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
    return error
  }
  console.log(`upserted ${toUpsert.length} games`)
  return null
}

// balldontlie has no NBA Cup flag, so read ESPN's game notes
// ("NBA Cup - Group Play", "NBA Cup - East Quarterfinal", …) into
// games.stage, which the app uses for Cup styling
const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
const ESPN_TO_APP = {
  GS: 'GSW',
  NY: 'NYK',
  NO: 'NOP',
  SA: 'SAS',
  UTAH: 'UTA',
  WSH: 'WAS',
}

async function fetchCupStages(date) {
  // ESPN refuses requests without a browser-like User-Agent
  const response = await fetch(
    `${ESPN_SCOREBOARD}?dates=${date.replaceAll('-', '')}`,
    { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } },
  )
  if (!response.ok) {
    throw new Error(`ESPN ${response.status} for ${date}`)
  }
  const { events = [] } = await response.json()
  return events.flatMap(event => {
    const competition = event.competitions?.[0] || {}
    const note = (competition.notes || [])
      .map(n => n.headline || '')
      .find(headline => /nba cup/i.test(headline))
    const home = (competition.competitors || []).find(
      team => team.homeAway === 'home',
    )
    const abbr = home?.team?.abbreviation
    if (!note || !abbr) return []
    return [{ date, homeAbbr: ESPN_TO_APP[abbr] || abbr, stage: note }]
  })
}

async function tagCupGames(supabase, dates) {
  const stages = []
  const errors = []
  // A handful of dates at a time keeps ESPN happy and the run short
  for (let i = 0; i < dates.length; i += 8) {
    const batch = await Promise.allSettled(
      dates.slice(i, i + 8).map(fetchCupStages),
    )
    for (const result of batch) {
      if (result.status === 'fulfilled') stages.push(...result.value)
      else errors.push(String(result.reason))
    }
  }
  const summary = {
    found: stages.length,
    tagged: 0,
    errors: errors.slice(0, 3),
  }
  if (!stages.length) return summary

  const { data: games, error } = await supabase
    .from('games')
    .select('id, date, stage, home_team:home_team_id(abbreviation)')
    .in('date', [...new Set(stages.map(s => s.date))])
  if (error) {
    console.error(error)
    return { ...summary, errors: [error.message] }
  }

  // Only ever set a stage: a missing note never clears an existing one
  const idsByStage = {}
  for (const { date, homeAbbr, stage } of stages) {
    const game = games.find(
      g => g.date === date && g.home_team?.abbreviation === homeAbbr,
    )
    if (!game || game.stage === stage) continue
    ;(idsByStage[stage] ||= []).push(game.id)
  }

  for (const [stage, ids] of Object.entries(idsByStage)) {
    const { error: updateError } = await supabase
      .from('games')
      .update({ stage })
      .in('id', ids)
    if (updateError) {
      console.error(updateError)
      continue
    }
    summary.tagged += ids.length
  }
  return summary
}

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
