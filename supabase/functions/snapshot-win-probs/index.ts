import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Stores ESPN's pre-game win probability for games tipping in the next
// 7 days, so the upset tag shows across the whole day strip. Run every 30
// minutes; the last snapshot before tip-off is the one the upset bonus is
// scored on, so started games are never touched.

const ESPN_SUMMARY =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary'
const WINDOW_HOURS = 7 * 24

Deno.serve(async () => {
  // MY_* lets a locally served function target another project;
  // deployed functions get SUPABASE_* injected by the platform
  const supabase = createClient(
    Deno.env.get('MY_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      '',
  )

  const now = new Date()
  const until = new Date(now.getTime() + WINDOW_HOURS * 36e5)
  const { data: games, error } = await supabase
    .from('games')
    .select('id, espn_event_id, tip_at')
    .not('espn_event_id', 'is', null)
    .gt('tip_at', now.toISOString())
    .lte('tip_at', until.toISOString())
  if (error) {
    console.error(error)
    return json({ error: error.message }, 500)
  }

  const summary = { games: games.length, updated: 0, missing: 0, errors: [] }
  // A handful at a time keeps ESPN happy
  for (let i = 0; i < games.length; i += 8) {
    const batch = await Promise.allSettled(
      games.slice(i, i + 8).map(async game => {
        const homeWinProb = await fetchHomeWinProb(game.espn_event_id)
        if (homeWinProb === null) {
          summary.missing++
          return
        }
        const takenAt = new Date()
        // The game may have tipped while ESPN was answering
        if (takenAt >= new Date(game.tip_at)) return
        const { error: updateError } = await supabase
          .from('games')
          .update({
            home_win_prob: homeWinProb,
            win_prob_at: takenAt.toISOString(),
          })
          .eq('id', game.id)
          .gt('tip_at', takenAt.toISOString())
        if (updateError) throw updateError
        summary.updated++
      }),
    )
    for (const result of batch) {
      if (result.status === 'rejected') {
        summary.errors.push(String(result.reason?.message ?? result.reason))
      }
    }
  }
  summary.errors = summary.errors.slice(0, 3)
  console.log(JSON.stringify(summary))
  return json(summary)
})

async function fetchHomeWinProb(eventId) {
  // ESPN refuses requests without a browser-like User-Agent
  const response = await fetch(`${ESPN_SUMMARY}?event=${eventId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`ESPN ${response.status} for event ${eventId}`)
  }
  const summary = await response.json()
  const projection = parseFloat(summary.predictor?.homeTeam?.gameProjection)
  if (!Number.isFinite(projection) || projection < 0 || projection > 100) {
    return null
  }
  return Math.round(projection * 100) / 100
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
