import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

console.log('Get injuries function!')

// RotoWire's free table now stops at five players, so read ESPN's report
const ESPN_INJURIES =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries'
// ESPN uses a few short codes that differ from ours
const ESPN_TO_APP = {
  GS: 'GSW',
  NY: 'NYK',
  NO: 'NOP',
  SA: 'SAS',
  UTAH: 'UTA',
  WSH: 'WAS',
}

Deno.serve(async req => {
  // ESPN refuses requests without a browser-like User-Agent
  const response = await fetch(ESPN_INJURIES, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  })
  if (!response.ok) {
    console.error(`ESPN ${response.status} for injuries`)
    return json({ error: `ESPN ${response.status}` }, 502)
  }
  const { injuries: teams = [] } = await response.json()

  // Same shape the RotoWire feed had: player, team, position, injury, status
  const injuries = teams.flatMap(team =>
    (team.injuries || []).flatMap(entry => {
      const athlete = entry.athlete || {}
      const abbr = athlete.team?.abbreviation
      if (!athlete.displayName || !abbr) return []
      return [
        {
          player: athlete.displayName,
          team: ESPN_TO_APP[abbr] || abbr,
          position: athlete.position?.abbreviation || '',
          injury: entry.details?.type || 'Undisclosed',
          status: entry.status || '',
        },
      ]
    }),
  )
  console.log(`found ${injuries.length} injuries`)

  return json(injuries)
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Content-Type': 'application/json',
    },
  })
}
